# Angular + Storybook + Puck composer

Lets frontend devs drag-and-drop pages together from the **real Angular component library**
and send management a link, without Figma and without AI tools. Everything is self-hosted, with no
cloud services.

- **Angular** stays the source of truth: components live in an Angular library.
- **Storybook for Angular** documents them.
- **[Puck](https://puckeditor.com)** (MIT, React) is the visual editor. It renders the Angular components
  through **[Angular Elements](https://angular.dev/guide/elements)**, which packages them as standard Web
  Components.

**Contents**

1. [What's in this repo & quick start](#1-whats-in-this-repo--quick-start)
2. [How it works](#2-how-it-works)
3. [Requirements](#3-requirements)
4. [Setup in an existing Angular project: Storybook](#4-setup-in-an-existing-angular-project-storybook)
5. [Setup in an existing Angular project: Puck composer](#5-setup-in-an-existing-angular-project-puck-composer)
6. [Guide: how a component becomes available in Puck](#6-guide-how-a-component-becomes-available-in-puck)
7. [Design decisions](#7-design-decisions)
8. [Docker & Docker Swarm](#8-docker--docker-swarm)
9. [Troubleshooting](#9-troubleshooting)
10. [Known limitations](#10-known-limitations)

---

## 1. What's in this repo & quick start

```
.
├── projects/
│   ├── ui/          # Angular library @apc/ui: components, design tokens, Storybook stories, specs
│   └── elements/    # Angular app that registers the components as custom elements (<apc-*>)
├── composer/        # React + Vite + Puck editor; loads the elements bundle at runtime
├── server/          # zero-dependency Node server: serves the composer + stores pages as JSON
├── docker/          # Dockerfiles (composer, storybook)
├── compose.yml      # local Docker
└── stack.yml        # Docker Swarm
```

Node `^22.22.3 || ^24.15.0` and pnpm 12 (`corepack enable` or `npm i -g pnpm@12`).

```sh
pnpm install
pnpm build:elements   # once, so the composer has a bundle to load
pnpm dev              # elements watch-build + composer  → http://localhost:3001
pnpm storybook        # Storybook for Angular           → http://localhost:6006
pnpm test             # library unit tests (vitest)
```

In the composer, click **Seed demo page**, then **edit** (Puck editor) or **view** (the link for
management). After changing an Angular component, `pnpm dev` rebuilds the bundle; reload the composer.

| Script | Does |
|---|---|
| `pnpm dev` | `ng build elements --watch` + Vite dev server for the composer (port 3001) |
| `pnpm storybook` / `pnpm build:storybook` | Storybook for Angular (port 6006 / `dist/storybook`) |
| `pnpm build:elements` | Angular Elements bundle → `dist/elements/browser` |
| `pnpm build:composer` | Composer → `composer/dist` (copies the elements bundle into `dist/elements`) |
| `pnpm build` | All three |
| `pnpm test` | Unit tests for `@apc/ui` |
| `docker compose up --build` | Composer on :3001, Storybook on :6006 in containers |

### What has been verified

Tested in headless Chromium against both the dev servers and the Docker images:

| Check | Result |
|---|---|
| Storybook for Angular renders all components and the `Pages/Dashboard` story | ✓ |
| Puck editor renders the Angular elements; demo page loads | ✓ |
| Changing a field in Puck updates the Angular component (zoneless, signal inputs) | ✓ |
| `<ng-content>`: Puck-managed children inside `<apc-card>` are projected in the right place | ✓ |
| Dropping a block **into** the card and deleting it again (no DOM errors) | ✓ |
| A component added by following [section 6](#6-guide-how-a-component-becomes-available-in-puck) (`Quote`) shows up in Puck and Storybook | ✓ |
| Angular `output()` reaches React as a DOM event (share view shows a toast) | ✓ |
| Page saved through the server; share view renders it without the editor | ✓ |

**Not tested:** a real multi-node `docker stack deploy` (`stack.yml` is only validated with
`docker compose config`), and Angular versions other than 22.

---

## 2. How it works

```
your Angular components (library or app)
   │                              │
   │ Storybook for Angular        │ elements build target (createCustomElement)
   ▼                              ▼
Storybook                   dist/elements/browser/main.js + styles.css
                                  │   defines <apc-card>, <apc-stat-card>, …
                                  ▼
                    composer (React 19 + Puck) loads /elements/main.js at runtime
                                  │   Puck config renders <apc-*> tags
                                  ▼
                 /edit/:slug  (editor, devs)      /view/:slug  (share link, management)
                                  │
                    page server: one JSON file per page in /data
```

- **Two independent builds.** The composer never imports Angular code. It loads the finished
  elements bundle through a `<script>` tag (`composer/src/elements.ts`), so Angular and React versions
  don't affect each other. The bundle is ~146 kB (43 kB gzipped) for the Angular runtime plus all 12
  components.
- **Readiness handshake.** After defining every tag, the bundle sets `window.apcElements` and fires
  an `apc-elements-ready` event. React renders only after that, so React 19 sets props as real
  **properties** (numbers stay numbers) rather than string attributes.
- **Layout is React, content is Angular.** Section/Stack/Grid blocks are plain React elements using
  the library's CSS classes. All content blocks are Angular components.
- **Pages are JSON.** Puck's data model (`{ root, content: [{ type, props }] }`) is saved by the page
  server and rendered by Puck's `<Render>` for the share view.

---

## 3. Requirements

| | Version | Why |
|---|---|---|
| Node | `^22.22.3 \|\| ^24.15.0 \|\| >=26` | Angular CLI 22 engine requirement |
| Angular | **22** (tested). Probably 18+ (Storybook 10's supported range), untested | `@angular/elements`, signal inputs |
| `@angular/elements` | same as `@angular/core` | builds the custom elements |
| TypeScript | `~6.0` for Angular 22 | Angular compiler peer dependency |
| Storybook | 10.x: `storybook`, `@storybook/angular`, `@storybook/addon-docs` | |
| `@angular-devkit/build-angular` | same major as Angular | **required by `@storybook/angular`**, even if your app builds with `@angular/build` |
| React | **19** (composer only) | React 18 passes everything to custom elements as string attributes; 19 sets properties |
| Puck | `@puckeditor/core` 0.23 (0.x, pin it) | the editor |
| Vite | 7.x (composer only) | dev server/build for the composer |
| Package manager | pnpm 12 (used here), npm/yarn work too | workspaces for `composer/` and `server/` |
| Browser | any evergreen | Custom Elements v1 |

**Your components must be standalone** (the default since Angular 19). NgModule-declared components
need converting, or a standalone wrapper. See the component checklist in [section 6.6](#66-component-checklist).

---

## 4. Setup in an existing Angular project: Storybook

Skip this if the project already has Storybook for Angular.

### 4.1 Install

The automatic route detects Angular, installs the packages, writes `.storybook/` and adds
`storybook`/`build-storybook` targets to `angular.json`:

```sh
npx storybook@10 init
```

Or manually (what this repo does):

```sh
pnpm add -D storybook@^10 @storybook/angular@^10 @storybook/addon-docs@^10 \
            @angular-devkit/build-angular@^22 @types/node
```

> With pnpm ≥ 11, dependency build scripts are blocked by default. The Angular CLI needs these, so
> add them to `pnpm-workspace.yaml`:
>
> ```yaml
> allowBuilds:
>   esbuild: true
>   "@parcel/watcher": true
>   lmdb: true
>   msgpackr-extract: true
> ```

### 4.2 `angular.json` targets

Add to the project that owns the components (library or app). `browserTarget` points at that
project's build target. `styles` must contain **every global stylesheet the components rely on**
(tokens, fonts, resets):

```jsonc
"storybook": {
  "builder": "@storybook/angular:start-storybook",
  "options": {
    "configDir": "projects/ui/.storybook",
    "browserTarget": "ui:build",
    "compodoc": false,
    "styles": ["projects/ui/src/lib/styles/tokens.css"],
    "port": 6006
  }
},
"build-storybook": {
  "builder": "@storybook/angular:build-storybook",
  "options": {
    "configDir": "projects/ui/.storybook",
    "browserTarget": "ui:build",
    "compodoc": false,
    "styles": ["projects/ui/src/lib/styles/tokens.css"],
    "outputDir": "dist/storybook"
  }
}
```

`compodoc: true` (plus `pnpm add -D @compodoc/compodoc`) generates controls and docs from the
component inputs. This repo writes `argTypes` by hand instead.

### 4.3 `.storybook/` files

`projects/ui/.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/angular', options: {} },
  core: { disableTelemetry: true },
};
export default config;
```

`projects/ui/.storybook/preview.ts` wraps every story in the same container the composer uses
(`.ui-canvas` + `data-theme`), with a theme switcher in the toolbar:

```ts
import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  globalTypes: {
    theme: { description: 'Design token theme', toolbar: { icon: 'paintbrush', items: ['light', 'dark'], dynamicTitle: true } },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    componentWrapperDecorator(
      (story) => `<div class="ui-canvas" [attr.data-theme]="theme" style="padding: 16px">${story}</div>`,
      ({ globals }) => ({ theme: globals['theme'] }),
    ),
  ],
  tags: ['autodocs'],
};
export default preview;
```

`projects/ui/.storybook/tsconfig.json`

```json
{
  "extends": "../tsconfig.lib.json",
  "compilerOptions": { "types": ["node"], "allowSyntheticDefaultImports": true, "resolveJsonModule": true },
  "exclude": ["../src/**/*.spec.ts"],
  "include": ["../src/**/*.stories.*", "./preview.ts"],
  "files": []
}
```

### 4.4 Stories

One file per component (`projects/ui/src/stories/*.stories.ts`). Outputs can be wired to the actions
panel:

```ts
import type { Meta, StoryObj } from '@storybook/angular';
import { Button } from '../lib/button';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
  args: { label: 'Get started', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    pressed: { action: 'pressed' },
  },
};
export default meta;
export const Primary: StoryObj<Button> = {};
```

Page-level compositions in code are still useful as a reference (see
`projects/ui/src/stories/dashboard.stories.ts`, using `moduleMetadata({ imports: [...] })`).

### 4.5 Run / host

```sh
ng run ui:storybook          # dev
ng run ui:build-storybook    # static output in dist/storybook → any web server (nginx image in docker/)
```

---

## 5. Setup in an existing Angular project: Puck composer

You add three things to the existing workspace:

| Piece | What | Where in this repo |
|---|---|---|
| **A. Elements build** | An Angular build target that registers your components as custom elements | `projects/elements/` + `angular.json` |
| **B. Composer** | A small React + Vite + Puck app that loads that bundle | `composer/` |
| **C. Page server** | Serves the composer and stores pages (JSON files) | `server/` |

Your existing app is untouched. The composer is a separate internal tool next to it.

### 5.1 Make the components importable

The elements build imports the components, so they need an import path. In this repo it's a `tsconfig`
path to the library **source**, so no library build is needed first:

```jsonc
// tsconfig.json
"paths": { "@apc/ui": ["./projects/ui/src/public-api.ts"] }
```

If your components live inside the app rather than a library, import them by relative path in step
5.2. That works the same way.

### 5.2 A. Elements build target

```sh
pnpm add @angular/elements@^22
ng generate application elements --style=css --skip-tests --ssr=false --routing=false
```

Delete the generated `src/app/` and `public/`, then replace `projects/elements/src/main.ts`:

```ts
import { provideBrowserGlobalErrorListeners, type Type } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { Button, Card, StatCard /* … */ } from '@apc/ui';

// Tag → component. Use a prefix that is NOT your component selector prefix (see section 7).
const elements: Record<string, Type<unknown>> = {
  'apc-button': Button,
  'apc-card': Card,
  'apc-stat-card': StatCard,
  // …
};

const app = await createApplication({
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Add whatever your components inject, e.g. provideHttpClient(), provideRouter([]),
    // your translation/i18n providers, icon registries, …
  ],
});

for (const [tag, component] of Object.entries(elements)) {
  if (!customElements.get(tag)) {
    customElements.define(tag, createCustomElement(component, { injector: app.injector }));
  }
}

// Readiness handshake for the composer.
declare global { interface Window { apcElements?: string[] } }
window.apcElements = Object.keys(elements);
document.dispatchEvent(new CustomEvent('apc-elements-ready', { detail: window.apcElements }));
```

`angular.json`, in the `elements` build target. These are the parts that differ from the generated
defaults:

```jsonc
"options": {
  "browser": "projects/elements/src/main.ts",
  "tsConfig": "projects/elements/tsconfig.app.json",
  "styles": ["projects/ui/src/lib/styles/tokens.css"]   // all global CSS your components need
},
"configurations": {
  "production": {
    "outputHashing": "none",                             // composer loads main.js/styles.css by fixed name
    "budgets": [{ "type": "initial", "maximumWarning": "400kB", "maximumError": "1MB" }]
  }
}
```

The output is `dist/elements/browser/{main.js,styles.css}`. Smoke-test it without any framework by
opening `projects/elements/src/index.html` through `ng serve elements`.

**Zone.js vs zoneless:** Angular 22 (used here) is zoneless by default, and signal inputs set through
the element trigger change detection on their own. If your project still uses zone.js, choose one:

- make the elements build zoneless: `provideZonelessChangeDetection()` (Angular 20+) in the
  `createApplication` providers. This works for OnPush/signal-based components.
- or add `"polyfills": ["zone.js"]` to the elements target. This is needed if components update
  through non-signal state from timers, promises or subscriptions without `markForCheck()`.

### 5.3 B. Composer app

Copy `composer/` from this repo into your workspace and register it as a workspace package:

```yaml
# pnpm-workspace.yaml
packages:
  - composer
  - server
```

(npm/yarn: `"workspaces": ["composer", "server"]` in the root `package.json`.)

Its dependencies (`composer/package.json`): `react@^19`, `react-dom@^19`, `@puckeditor/core@^0.23`,
`vite@^7`, `@vitejs/plugin-react@^5`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`,
and `@apc/page-server` (workspace).

What each file does and what you adapt:

| File | Purpose | Adapt? |
|---|---|---|
| `vite.config.ts` | Serves `../dist/elements/browser` at `/elements/*` in dev; copies it into `dist/elements` on build | path, if your output dir differs |
| `src/elements.ts` | Loads the bundle, waits for `apc-elements-ready`; `useCustomEvent()` for outputs | event/global name, if renamed |
| `src/custom-elements.d.ts` | JSX typings for the `apc-*` tags | **per component** |
| `src/config.tsx` | Puck config: fields + render per component, layout blocks, categories | **per component** |
| `src/App.tsx` | Routes `/`, `/edit/:slug`, `/view/:slug`; Puck with `iframe: { enabled: false }` | rarely |
| `src/demo.ts` | Example page for "Seed demo page" | optional |
| `src/main.tsx` | Loads elements, then renders; imports `@puckeditor/core/no-external.css` | no |

Add scripts to the root `package.json`:

```json
{
  "build:elements": "ng build elements",
  "build:composer": "pnpm --filter @apc/composer build",
  "dev": "pnpm run \"/^dev:/\"",
  "dev:elements": "ng build elements --watch --configuration development",
  "dev:composer": "pnpm --filter @apc/composer dev"
}
```

### 5.4 C. Page server

Copy `server/`. It is ~150 lines of plain Node with no dependencies:

- `GET /api/pages`, `GET|PUT /api/pages/:slug`: one JSON file per page in `DATA_DIR`, written
  atomically.
- Serves the built composer from `STATIC_DIR`, with SPA fallback so `/view/foo` works.
- `GET /healthz` for container health checks.
- The same API runs inside the Vite dev server (`server/vite-plugin.mjs`), so dev and prod behave the
  same.

To store pages elsewhere (Postgres, S3, an existing CMS), replace `server/store.mjs`. It's three
functions: `list`, `get`, `put`.

### 5.5 Global styles

Two rules matter, because the composer renders components **in the same document as Puck's editor
UI** (no iframe):

1. Every global stylesheet your components need (tokens, fonts, icon fonts) goes into the elements
   target's `styles`. It ends up in `/elements/styles.css`, which the composer loads.
2. **Don't ship unscoped element selectors** (`body {}`, `button {}`, `h1 {}`, `* {}` resets). They
   would restyle Puck's sidebars. Put base typography under a wrapper class instead. This repo uses
   `.ui-canvas`, which Puck's root block and Storybook's decorator both apply.

### 5.6 Done: verify

```sh
pnpm build:elements && pnpm dev
```

Open http://localhost:3001 → **Seed demo page** (or create one) → **edit**. Your components should be
in the left drawer.

---

## 6. Guide: how a component becomes available in Puck

The pipeline, using `Quote` (added to this repo by following exactly these steps):

```
① Angular component  →  ② Storybook story  →  ③ custom element tag  →  ④ JSX typing  →  ⑤ Puck config
  projects/ui            projects/ui/stories     projects/elements       composer/src       composer/src
```

Steps ③–⑤ are what make it appear in Puck. Steps ③–⑤ repeat the component's inputs by hand. That
duplication is the main maintenance cost, and the obvious target for code generation later (from the
Angular sources or compodoc's JSON).

### 6.1 Build the component (①)

`projects/ui/src/lib/quote.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-quote',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="quote">
      <blockquote>“{{ text() }}”</blockquote>
      @if (author()) { <figcaption>— {{ author() }}@if (role()) {, {{ role() }}}</figcaption> }
    </figure>
  `,
  styles: `
    :host { display: block; }
    .quote { margin: 0; padding: 24px; border-left: 4px solid var(--ui-primary); background: var(--ui-surface); border-radius: 6px; }
  `,
})
export class Quote {
  readonly text = input('Quote text');   // give every input a sensible default
  readonly author = input('');
  readonly role = input('');
}
```

Export it from `projects/ui/src/public-api.ts`: `export * from './lib/quote';`

### 6.2 Story (②)

`projects/ui/src/stories/quote.stories.ts`

```ts
import type { Meta, StoryObj } from '@storybook/angular';
import { Quote } from '../lib/quote';

const meta: Meta<Quote> = {
  title: 'Components/Quote',
  component: Quote,
  args: { text: 'We cut onboarding from two weeks to three days.', author: 'Ada Lovelace', role: 'Head of Growth' },
};
export default meta;
export const Default: StoryObj<Quote> = {};
```

### 6.3 Register the custom element (③)

`projects/elements/src/main.ts`: import it and add one line to the map:

```ts
import { /* … */ Quote } from '@apc/ui';

const elements = {
  // …
  'apc-quote': Quote,
};
```

That's all on the Angular side. The composer finds out about new tags through the readiness handshake.

### 6.4 JSX typing (④)

`composer/src/custom-elements.d.ts`: one line, mirroring the inputs:

```ts
"apc-quote": El<{ text?: string; author?: string; role?: string }>;
```

### 6.5 Puck config (⑤)

`composer/src/config.tsx`: three additions.

```tsx
// a) props type (drives type-checking of fields/defaultProps/render)
type Components = {
  // …
  Quote: { text: string; author: string; role: string };
};

// b) put it into a drawer category
categories: {
  content: { title: "Content", components: ["Heading", "Text", "Card", "Quote", /* … */] },
},

// c) the block itself
components: {
  Quote: {
    fields: { text: { type: "textarea" }, author: { type: "text" }, role: { type: "text" } },
    defaultProps: { text: "We cut onboarding from two weeks to three days.", author: "Ada Lovelace", role: "Head of Growth" },
    render: ({ puck, ...props }) => <apc-quote {...stripId(props)} />,
  },
},
```

- `fields` are the form controls in Puck's right sidebar. `defaultProps` are what a freshly dropped
  block gets.
- `render` maps Puck props onto the custom element. Always take `puck` out and run the rest through
  `stripId()`. Puck adds `id`/`editMode` props, which would otherwise end up as DOM attributes.
- The key (`Quote`) is the block's **type name in saved pages**. Don't rename it later without
  migrating pages ([6.9](#69-changing-components-later)).

Rebuild (`pnpm dev` does it automatically) and reload: **Quote** is in the drawer.

### 6.6 Component checklist

A component works well in Puck when it is:

- **Standalone**, with no dependency on being inside a specific parent component or route.
- **Presentational.** Data comes in through inputs, not from services that fetch or need a logged-in
  context. If a component injects a service, that service must be provided in the elements
  `createApplication` (section 5.2) or by the component itself.
- **Primitive inputs.** Use `string`, `number`, `boolean` and string unions. They map directly onto Puck
  fields. Arrays/objects need Puck `array`/`object` fields or custom fields; templates/`TemplateRef`
  inputs can't be edited at all. If a list is simple, a comma-separated string works (`Navbar.links`).
- **Defaults for every input,** so a freshly dropped block renders something sensible. Prefer
  `input('default')` over `input.required()`.
- **Self-styled.** Component styles (`styles`/`styleUrl`, emulated encapsulation) work as they are.
  Global CSS must be in the elements build (section 5.5).
- **No router dependency** (`routerLink`, `ActivatedRoute`), unless you provide `provideRouter([])`
  in the elements build.

### 6.7 Field types

| Angular input | Puck field | Example |
|---|---|---|
| `input('')` short text | `{ type: "text" }` | label, title |
| `input('')` long text | `{ type: "textarea" }` | body, quote |
| `input(0)` | `{ type: "number", min, max }` | value, size, columns |
| `input(false)` | `{ type: "radio", options: [{label:"yes",value:true},{label:"no",value:false}] }` | muted |
| `input<'a' \| 'b'>('a')` (2–3 options) | `{ type: "radio", options }` | trend, align |
| `input<'a' \| 'b' \| …>('a')` (more options) | `{ type: "select", options }` | tone, variant |
| `<ng-content>` | `{ type: "slot" }` (see 6.8) | card body |
| `string[]` / objects | `{ type: "array", arrayFields }` / `{ type: "object", objectFields }`, or a custom field | |

Booleans from Puck arrive as real booleans and numbers as numbers (React 19 sets properties).
Inputs that are also used as HTML attributes elsewhere can still use
`transform: booleanAttribute`/`numberAttribute`.

### 6.8 Components with `<ng-content>` (container blocks)

The Angular side needs nothing special. `Card` simply has `<ng-content />` in its template. On the
Puck side, declare a `slot` field and render the slot as the element's child:

```tsx
Card: {
  fields: { /* …inputs… */ content: { type: "slot" } },
  defaultProps: { /* … */ content: [] },
  render: ({ puck, content: Content, ...props }) => (
    <apc-card {...stripId(props)}>
      <Content />
    </apc-card>
  ),
},
```

Why it works: a Puck slot renders **one stable wrapper `<div>`**. When the element starts, Angular
projects that single node into `<ng-content>`. From then on React only adds and removes blocks
*inside* the wrapper, which React still owns, so there's no conflict.

Rules:

- **Exactly one stable element per `<ng-content>`.** Never render a list of React children directly
  inside a custom element whose content Angular projects; React would later try to remove nodes that
  Angular moved.
- **One default `<ng-content>` per component is the tested case.** Multi-slot projection
  (`<ng-content select="…">`) is untested. Since the slot wrapper takes a `className`, a class
  selector (`select=".actions"` + `<Actions className="actions" />`) is the approach to try.
- **Layout containers** (sections, stacks, grids) are easier as plain React blocks using your CSS
  classes, with the slot itself as the flex/grid container (`<Content className="ui-grid" />`, see
  `Grid` in `config.tsx`). Then dropped blocks are direct grid items.

### 6.9 Outputs

An `output()` becomes a DOM `CustomEvent` with the emitted value in `event.detail`. Listen with
`useCustomEvent()` from `composer/src/elements.ts` inside a small React component:

```tsx
function ButtonBlock(props: Components["Button"] & { editing: boolean }) {
  const ref = useCustomEvent("pressed", () => !props.editing && toast(`"${props.label}" pressed`));
  return <apc-button ref={ref} label={props.label} variant={props.variant} size={props.size} />;
}
// …
render: ({ puck, ...props }) => <ButtonBlock {...stripId(props)} editing={puck.isEditing} />,
```

For mock-ups, outputs rarely need to do anything. In the editor, Puck intercepts clicks anyway.

### 6.10 Changing components later

Saved pages contain the **block type name** (`"Quote"`) and **prop names** (`author`). Therefore:

- Adding an input: safe. Old pages don't have the prop, so React doesn't set it and the Angular input's own default applies (`defaultProps` only apply to newly dropped blocks).
- Renaming/removing an input or block: old pages keep the old name. Migrate the JSON files, or map old
  data in Puck's `resolveData`.
- Changing styling or markup: safe. Pages store data, not HTML.

---

## 7. Design decisions

**Puck's iframe is disabled** (`iframe={{ enabled: false }}`). Custom element definitions are per
window, so elements registered in the page wouldn't exist inside Puck's canvas iframe. The iframe only
buys correct mobile/tablet previews (media queries) and CSS isolation. The product is desktop-only, so
there's a single `Desktop` viewport. To bring the iframe back, inject the elements bundle into the
iframe document via Puck's `overrides.iframe`.

**Custom element tags (`apc-*`) differ from component selectors (`ui-*`).** If they were equal, the
`<ui-button>` that Angular renders inside `<ui-hero>` would *also* be upgraded as a custom element and
render a second button inside itself.

**Readiness handshake rather than a tag list in the composer.** The bundle announces its tags
(`window.apcElements` + `apc-elements-ready`), so adding a component never touches the loader.

**`@puckeditor/core/no-external.css`.** The default `puck.css` imports the Inter webfont from
rsms.me. This variant keeps the composer working offline.

**pnpm 12 supply-chain policy stays on.** Packages younger than 24h are refused
(`minimumReleaseAge`). That's why the Angular CLI range is `^22.2.0`, not the `^22.2.3` that `ng new`
generated hours after that release came out.

---

## 8. Docker & Docker Swarm

| Image | Runtime | Size | State |
|---|---|---|---|
| `composer` | `node:24-alpine` + `server/` (no node_modules) + built composer incl. `/elements` | ~245 MB | JSON files in `/data` |
| `storybook` | `nginx:alpine` + static Storybook | ~115 MB | none |

Both have a `HEALTHCHECK`. The composer runs as the non-root `node` user. Build context is the
repository root.

```sh
docker compose up --build                       # local: composer :3001, storybook :6006

# swarm
export REGISTRY=registry.example.com/apc TAG=1
docker compose build && docker compose push     # stack deploy ignores build: → push first
docker node update --label-add apc-data=true <node>
docker stack deploy -c stack.yml --with-registry-auth apc
```

- `docker stack deploy` doesn't read `.env`, so export `REGISTRY`/`TAG` in the shell.
- **Composer: 1 replica, pinned** to the labelled node. Pages are files on a node-local volume with no
  locking. For HA, use shared storage (NFS etc.) or swap `server/store.mjs` for a database.
- **Storybook:** stateless, 2 replicas, rolling `start-first` updates.
- **No auth built in.** Put the stack behind your reverse proxy with SSO/basic auth. Restrict
  `/edit/*` and `PUT /api/pages/*` to devs; `/view/*` is the management link.
- Everything works offline at runtime: no CDNs, Storybook telemetry off, Puck without external fonts.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Composer shows *Could not load /elements/main.js* | Bundle not built | `pnpm build:elements` (or run `pnpm dev`) |
| A block is in the drawer but renders empty | Tag not registered in `projects/elements/src/main.ts`, or the bundle is stale | Register it, rebuild, reload |
| Component renders twice inside itself | Custom element tag equals a component selector | Use a different prefix for tags |
| Numbers/booleans arrive as strings | React rendered before the element was defined, or React < 19 | Keep the readiness handshake; use React 19 |
| `id="Card-…"` / `editmode` attributes on elements | Puck props spread onto the element | Pass props through `stripId()` |
| Component looks unstyled in Puck but fine in Storybook | Global CSS only in Storybook's `styles` | Add it to the elements target's `styles` too |
| Puck's sidebars change font/buttons | Unscoped global selectors in your CSS | Scope them under a wrapper class (`.ui-canvas`) |
| `NullInjectorError` when an element starts | Component injects a service not provided in the elements app | Add the provider to `createApplication` |
| Component doesn't update after a field edit | Zone-dependent change detection in a zoneless build | Signal/OnPush, or add `zone.js` to the elements polyfills |
| Children dropped into a container end up outside it / DOM errors on delete | React children rendered directly into an element with `<ng-content>` | Render exactly one `<Content />` slot inside the element |
| `pnpm install` fails: *within the minimumReleaseAge cutoff* | A package version is under 24h old | Wait, or widen the range to allow the previous patch |
| `pnpm install` fails: *Ignored build scripts* | pnpm ≥ 11 blocks build scripts | Add them to `allowBuilds` in `pnpm-workspace.yaml` |
| Storybook fails to start with an error mentioning `@angular-devkit/build-angular` | Storybook's Angular builder needs it (peer dependency) | `pnpm add -D @angular-devkit/build-angular@<your major>` |

---

## 10. Known limitations

- **Puck is 0.x** (0.23 here). Minor versions can break things, so pin it and upgrade deliberately. MIT,
  so you could fork it.
- **Steps ③–⑤ duplicate the component's inputs by hand.** That's fine for a dozen components; for a
  large library, generate them.
- **Two frameworks in the repo.** React exists only inside `composer/`, an internal tool. The product
  stays Angular.
- **Editor and components share one document** (no iframe), so CSS hygiene matters (section 5.5).
- **No authentication, no versioning, no concurrent-edit protection** in the page server; last save
  wins.
- Tested with Angular 22, Storybook 10.6, Puck 0.23, React 19, Chromium only.
