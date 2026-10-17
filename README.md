# Angular + Storybook + Puck composer

Lets frontend devs drag-and-drop pages together from the **real Angular component library**
and send management a link, without Figma and without AI tools. Everything is self-hosted, with no
cloud services.

- **Angular** stays the source of truth: components live in an Angular library.
- **Storybook for Angular** documents them.
- **[Puck](https://puckeditor.com)** (MIT, React) is the visual editor. It renders the Angular components
  through **[Angular Elements](https://angular.dev/guide/elements)**, which packages them as standard Web
  Components.
- **The Puck integration is generated.** You write a component and its story; one script produces
  everything Puck needs. A second script checks that a component can be used in Puck.

**Contents**

1. [What's in this repo & quick start](#1-whats-in-this-repo--quick-start)
2. [How it works](#2-how-it-works)
3. [Requirements](#3-requirements)
4. [Setup in an existing Angular project: Storybook](#4-setup-in-an-existing-angular-project-storybook)
5. [Setup in an existing Angular project: Puck composer](#5-setup-in-an-existing-angular-project-puck-composer)
6. [Guide: making a component available in Puck](#6-guide-making-a-component-available-in-puck)
7. [The `puck:*` scripts](#7-the-puck-scripts)
8. [Running the checks in CI](#8-running-the-checks-in-ci)
9. [Design decisions](#9-design-decisions)
10. [Docker & Docker Swarm](#10-docker--docker-swarm)
11. [Troubleshooting](#11-troubleshooting)
12. [Known limitations](#12-known-limitations)

---

## 1. What's in this repo & quick start

```
.
├── projects/
│   ├── ui/                      # Angular library @apc/ui: components, design tokens, stories, specs
│   └── elements/                # Angular app that registers the components as custom elements (<apc-*>)
│       └── src/elements.generated.ts   ← generated
├── composer/                    # React + Vite + Puck editor; loads the elements bundle at runtime
│   └── src/generated/           ← generated: Puck blocks, JSX typings, schema manifest
├── scripts/puck/                # generator, verifier, smoke test (plain Node, no build step)
├── server/                      # zero-dependency Node server: serves the composer + stores pages as JSON
├── docker/                      # Dockerfiles (composer, storybook)
├── compose.yml                  # local Docker
└── stack.yml                    # Docker Swarm
```

Node `^22.22.3 || ^24.15.0` and pnpm 12 (`corepack enable` or `npm i -g pnpm@12`). Works on Linux,
macOS and natively on Windows (no WSL needed), see [3.1](#31-windows).

```sh
pnpm install
pnpm build:elements   # once, so the composer has a bundle to load
pnpm dev              # elements watch-build + composer  → http://localhost:3001
pnpm storybook        # Storybook for Angular           → http://localhost:6006
```

In the composer, click **Seed demo page**, then **edit** (Puck editor) or **view** (the link for
management). The view has a **Save image** button that exports the whole page as a PNG, including
everything below the fold.

| Script | Does |
|---|---|
| `pnpm dev` | `ng build elements --watch` + Vite dev server for the composer (port 3001) |
| `pnpm storybook` / `pnpm build:storybook` | Storybook for Angular (port 6006 / `dist/storybook`) |
| `pnpm puck:verify [Name…]` | Checks that components + stories can be used in Puck ([section 7](#7-the-puck-scripts)) |
| `pnpm puck:generate` | Regenerates the Puck integration from the stories |
| `pnpm puck:check` | Fails if the generated files are out of date |
| `pnpm puck:smoke` | Renders every block in headless Chromium (needs a build) |
| `pnpm build:elements` | Angular Elements bundle → `dist/elements/browser` |
| `pnpm build:composer` | Composer → `composer/dist` (copies the elements bundle into `dist/elements`) |
| `pnpm build` | Elements + composer + Storybook |
| `pnpm test` | Unit tests for `@apc/ui` (vitest) |
| `docker compose up --build` | Composer on :3001, Storybook on :6006 in containers |

### What has been verified

| Check | Result |
|---|---|
| All 12 components generated from their stories; generated files type-check | ✓ |
| `puck:smoke`: every generated block renders as an Angular element in the share view and appears in the editor drawer, no page errors | ✓ |
| `puck:smoke` **fails** when a component injects a service the elements app doesn't provide (`NG0201`) | ✓ |
| `puck:verify` reports every rule violation in a deliberately broken component/story (unsupported type, missing default, alias, two `<ng-content>`, `argTypes` ≠ type, unknown `parameters.puck` key, dynamic `meta`, not exported, …) and `puck:generate` refuses to write | ✓ |
| `puck:verify` detects breaking changes (renamed input, removed option) against the committed manifest; `--allow-breaking` downgrades them to warnings | ✓ |
| In the editor: changing a field updates the Angular component; blocks can be dropped into the Card's `<ng-content>`; Angular `output()` reaches React (share-view toast) | ✓ |
| Storybook for Angular renders all components and the `Pages/Dashboard` story | ✓ |
| **Save image** in the share view exports the full page (856 px page in a 600 px window → 2880×1712 PNG at 2×); an 8,600 px dark-theme page exports at a reduced ratio (2679×16000) instead of failing; the button itself is not in the image | ✓ |
| Docker images build, become healthy, and pass the same browser checks | ✓ |
| Natively on Windows 11 (PowerShell 5.1, Node 24 via fnm, Git for Windows with `autocrlf=true`, no WSL): `install`, `test`, all builds, `puck:verify`, `puck:smoke`, `dev`, `storybook`, `start` | ✓ |

**Not tested:** a real multi-node `docker stack deploy` (`stack.yml` is only validated with
`docker compose config`), and Angular versions other than 22.

---

## 2. How it works

```
             you write                                generated by pnpm puck:generate
 ┌──────────────────────────────┐        ┌──────────────────────────────────────────────────────┐
 │ projects/ui/src/lib/quote.ts │        │ projects/elements/src/elements.generated.ts   tag → class │
 │ projects/ui/src/stories/     │ ─────▶ │ composer/src/generated/custom-elements.d.ts   JSX typings │
 │   quote.stories.ts           │        │ composer/src/generated/blocks.tsx             Puck blocks │
 │   (tags: ['puck'])           │        │ composer/src/generated/puck-manifest.json     schema      │
 └──────────────────────────────┘        └──────────────────────────────────────────────────────┘
        │                                         │                          │
        │ Storybook for Angular                   │ ng build elements        │ Vite build
        ▼                                         ▼                          ▼
   Storybook (docs)                 /elements/main.js (custom elements) → composer (React + Puck)
                                                                             │
                                               /edit/:slug (devs)    /view/:slug (management)
                                                                             │
                                                         page server: one JSON file per page
```

- **The generator only reads code.** It uses the TypeScript type checker on the components (so
  `input<Tone>()` resolves to its actual options) and Angular's own template parser (to find
  `<ng-content>`). Stories are read statically. Nothing runs Angular, Storybook or a browser.
- **Two independent builds.** The composer never imports Angular code; it loads the finished elements
  bundle through a `<script>` tag. The bundle is ~146 kB (43 kB gzipped) for the Angular runtime plus
  all 12 components.
- **Readiness handshake.** After defining every tag, the bundle sets `window.apcElements` and fires
  `apc-elements-ready`. React renders only after that, so React 19 sets props as real properties
  (numbers stay numbers) rather than string attributes.
- **Layout is React, content is Angular.** Section/Stack/Grid are hand-written React blocks using the
  library's CSS classes. Every content block is generated and renders an Angular element.
- **Pages are JSON** (`{ root, content: [{ type, props }] }`), saved by the page server and rendered by
  Puck's `<Render>` in the share view.

---

## 3. Requirements

| | Version | Why |
|---|---|---|
| Node | `^22.22.3 \|\| ^24.15.0 \|\| >=26` | Angular CLI 22 engine requirement; the scripts are plain Node ESM |
| Angular | **22** (tested). Probably 18+ (Storybook 10's supported range), untested | `@angular/elements`, signal inputs |
| `@angular/elements` | same as `@angular/core` | builds the custom elements |
| `@angular/compiler` | same as `@angular/core` (already a dependency) | generator: template parsing |
| TypeScript | `~6.0` for Angular 22 | Angular compiler + generator: type analysis |
| Prettier | 3.x (Angular CLI projects already have it) | generator: deterministic formatting |
| Storybook | 10.x: `storybook`, `@storybook/angular`, `@storybook/addon-docs` | |
| `@angular-devkit/build-angular` | same major as Angular | **required by `@storybook/angular`**, even if your app builds with `@angular/build` |
| React | **19** (composer only) | React 18 passes everything to custom elements as string attributes |
| Puck | `@puckeditor/core` 0.23 (0.x, pin it) | the editor |
| Vite | 7.x (composer only) | composer dev server/build |
| Playwright | 1.64+ (dev only) + Chromium | `puck:smoke` |
| Package manager | pnpm 12 (used here); npm/yarn work too | workspaces for `composer/` and `server/` |

**Components must be standalone** (the default since Angular 19). The full rule set is in
[6.4](#64-rules-for-components-and-stories); `pnpm puck:verify` checks it.

### 3.1 Windows

Everything runs natively on Windows; WSL and Docker are not needed. One-time setup in PowerShell:

```powershell
winget install Schniz.fnm      # Node version manager (like nvm); reads .node-version / .nvmrc
winget install Git.Git
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # lets PowerShell run the profile and npm/pnpm shims
Add-Content $PROFILE 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
# open a new terminal, then:
fnm install 24
corepack enable                # pnpm version from package.json
```

Then clone to a normal Windows path (e.g. `C:\dev`, not a `\\wsl$` share) and follow the quick start.
`pnpm exec playwright install chromium` works the same way for `puck:smoke`.

- **Line endings:** `.gitattributes` forces LF, so Git for Windows' default `autocrlf=true` doesn't
  make `puck:check` report the generated files as out of date. If you cloned before it existed, commit
  or stash your work, then rewrite the checkout: `git rm -r -q --cached .; git reset --hard`
- **Shell syntax in this README** is POSIX. In PowerShell set env vars with `$env:CHROMIUM_PATH = '…'`;
  `a && b` needs PowerShell 7 (`winget install Microsoft.PowerShell`). In Windows PowerShell 5.1 use `a; b`.
- **Speed:** Defender's real-time scan slows `pnpm install` and builds noticeably. A
  [Dev Drive](https://learn.microsoft.com/windows/dev-drive/) or an exclusion for the repo folder helps.

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

Add to the project that owns the components. `browserTarget` points at that project's build target.
`styles` must contain **every global stylesheet the components rely on** (tokens, fonts):

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

`projects/ui/.storybook/tsconfig.json`. **The generator reads stories through this file**
(`scripts/puck/config.mjs` → `storiesTsconfig`), so it must include them:

```json
{
  "extends": "../tsconfig.lib.json",
  "compilerOptions": { "types": ["node"], "allowSyntheticDefaultImports": true, "resolveJsonModule": true },
  "exclude": ["../src/**/*.spec.ts"],
  "include": ["../src/**/*.stories.*", "./preview.ts"],
  "files": []
}
```

### 4.4 Run / host

```sh
ng run ui:storybook          # dev
ng run ui:build-storybook    # static output in dist/storybook → any web server (nginx image in docker/)
```

---

## 5. Setup in an existing Angular project: Puck composer

You add four things to the existing workspace. Your existing app stays untouched; the composer is a
separate internal tool next to it.

| Piece | What | Copy from this repo |
|---|---|---|
| **A. Generator scripts** | Produce and check the Puck integration from stories | `scripts/puck/` |
| **B. Elements build** | Angular build target that registers the components as custom elements | `projects/elements/` + `angular.json` target |
| **C. Composer** | React + Vite + Puck app that loads the elements bundle | `composer/` |
| **D. Page server** | Serves the composer, stores pages as JSON | `server/` |

### 5.1 A. Generator scripts

Copy `scripts/puck/` and adapt **only** `scripts/puck/config.mjs`:

```js
export const config = {
  storiesTsconfig: 'projects/ui/.storybook/tsconfig.json', // tsconfig that includes your stories
  tag: 'puck',                                             // opt-in story tag
  selectorPrefix: 'ui-',                                   // your component selector prefix
  tagPrefix: 'apc-',                                       // custom element prefix (must differ!)
  libraryImport: '@apc/ui',                                // how generated code imports components
  libraryEntry: 'projects/ui/src/public-api.ts',           // file that exports them
  out: { /* where the 4 generated files go */ },
  defaultCategory: 'Components',
  longTextWarning: 60,
};
```

The library must be importable under `libraryImport`. In this repo that's a `tsconfig` path to the
**source**, so no library build is needed first:

```jsonc
// tsconfig.json
"paths": { "@apc/ui": ["./projects/ui/src/public-api.ts"] }
```

Add the scripts and Playwright (for the smoke test):

```sh
pnpm add -D playwright@^1.64 && pnpm exec playwright install chromium
```

```json
"puck:generate": "node scripts/puck/generate.mjs",
"puck:check": "node scripts/puck/generate.mjs --check",
"puck:verify": "node scripts/puck/verify.mjs",
"puck:smoke": "node scripts/puck/smoke.mjs"
```

### 5.2 B. Elements build target

```sh
pnpm add @angular/elements@^22
ng generate application elements --style=css --skip-tests --ssr=false --routing=false
```

Delete the generated `src/app/` and `public/`, then replace `projects/elements/src/main.ts`. The
**tag → component map is generated**; this file only holds what can't be generated, namely the
services your components inject:

```ts
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { elements } from './elements.generated';

const app = await createApplication({
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Everything your components inject that isn't providedIn: 'root', e.g. provideRouter([]),
    // translation/i18n providers, icon registries. `pnpm puck:smoke` fails if something is missing.
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

**Zone.js vs zoneless:** Angular 22 is zoneless by default, and signal inputs set through the
element trigger change detection on their own. If your project still uses zone.js, either add
`provideZonelessChangeDetection()` (Angular 20+) to the providers above, which works for
OnPush/signal components, or add `"polyfills": ["zone.js"]` to the elements target. The latter is
needed for components that update through non-signal state without `markForCheck()`.

### 5.3 C. Composer

Copy `composer/` and register it (and the server) as workspace packages:

```yaml
# pnpm-workspace.yaml  (npm/yarn: "workspaces": ["composer", "server"] in package.json)
packages:
  - composer
  - server
```

Dependencies (`composer/package.json`): `react@^19`, `react-dom@^19`, `@puckeditor/core@^0.23`, `html-to-image@^1.11`,
`vite@^7`, `@vitejs/plugin-react@^5`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`,
and `@apc/page-server` (workspace).

| File | Purpose | You edit it? |
|---|---|---|
| `src/generated/*` | Puck blocks, JSX typings, manifest | **never**, regenerate instead |
| `src/config.tsx` | Root (theme), hand-written layout blocks, merges generated blocks + overrides | rarely |
| `src/overrides.tsx` | Exceptions for generated blocks (e.g. Button's output → toast) | when a block needs custom behaviour |
| `src/elements.ts` | Loads the bundle, waits for `apc-elements-ready`; `useCustomEvent()` | no |
| `src/App.tsx` | Routes `/`, `/edit/:slug`, `/view/:slug`; Puck with `iframe: { enabled: false }` | rarely |
| `src/save-image.tsx` | **Save image** button in the share view (full-page PNG via `html-to-image`) | no |
| `vite.config.ts` | Serves `../dist/elements/browser` at `/elements/*`; copies it into `dist/` on build | only if paths differ |
| `src/demo.ts` | Example page for "Seed demo page" | optional |

Root scripts:

```json
"build:elements": "ng build elements",
"build:composer": "pnpm --filter @apc/composer build",
"dev": "pnpm run \"/^dev:/\"",
"dev:elements": "ng build elements --watch --configuration development",
"dev:composer": "pnpm --filter @apc/composer dev"
```

### 5.4 D. Page server

Copy `server/` (~150 lines, no dependencies):

- `GET /api/pages`, `GET|PUT /api/pages/:slug`: one JSON file per page in `DATA_DIR`, written atomically.
- Serves the built composer from `STATIC_DIR` with SPA fallback; `GET /healthz` for health checks.
- The same API runs inside the Vite dev server (`server/vite-plugin.mjs`).

To store pages elsewhere (Postgres, S3, a CMS), replace `server/store.mjs`. It's three functions:
`list`, `get`, `put`.

### 5.5 Global styles

The composer renders components **in the same document as Puck's editor UI** (no iframe):

1. Every global stylesheet your components need goes into the elements target's `styles`. It ends up in
   `/elements/styles.css`, which the composer loads.
2. **Don't ship unscoped element selectors** (`body {}`, `button {}`, `* {}` resets). They would
   restyle Puck's sidebars. Put base typography under a wrapper class (here `.ui-canvas`, applied by
   Puck's root block and Storybook's decorator).

### 5.6 First run

```sh
pnpm puck:verify        # fix what it reports
pnpm puck:generate
pnpm build:elements && pnpm dev
```

Open http://localhost:3001 → create a page → **edit**. Your opted-in components are in the left drawer.

---

## 6. Guide: making a component available in Puck

You write **two files**: the component and its story. Then:

```sh
pnpm puck:verify Quote    # is it Puck-ready? (fast, static)
pnpm puck:generate        # regenerate the integration
pnpm dev                  # or rebuild; reload the composer → it's in the drawer
```

Commit the generated files together with the component and story.

### 6.1 The component

A normal standalone Angular component. Nothing Puck-specific:

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
})
export class Quote {
  readonly text = input('Quote text');
  readonly author = input('');
  readonly role = input('');
}
```

Export it from the library entry (`projects/ui/src/public-api.ts`): `export * from './lib/quote';`

### 6.2 The story

A normal Storybook story plus two additions: the `puck` tag (opt-in) and a small `parameters.puck`
block for what can't be inferred:

```ts
import type { Meta, StoryObj } from '@storybook/angular';
import { Quote } from '../lib/quote';

const meta: Meta<Quote> = {
  title: 'Components/Quote',
  component: Quote,
  tags: ['puck'],
  parameters: { puck: { category: 'Content', fields: { text: 'textarea' } } },
  args: { text: 'We cut onboarding from two weeks to three days.', author: 'Ada Lovelace', role: 'Head of Growth' },
};
export default meta;

export const Default: StoryObj<Quote> = {};
```

### 6.3 What is inferred, and from where

| Puck needs | Taken from | Example |
|---|---|---|
| Custom element tag | selector, prefix swapped | `ui-quote` → `<apc-quote>` |
| Block type name (stored in saved pages!) | selector, PascalCase | `ui-stat-card` → `StatCard` |
| Editable props + their types | component inputs, via the TypeScript type checker | `input<Tone>('info')` → `'neutral' \| … \| 'info'` |
| Field kind: `string` | `text`; `textarea` only via `parameters.puck.fields` | |
| Field kind: `number` | `number`; `min`/`max`/`step` from `argTypes` `range`/`number` control | `{ control: { type: 'range', min: 0, max: 100 } }` |
| Field kind: `boolean` | yes/no radio | |
| Field kind: union of literals | `argTypes` control `radio`/`select`; else radio for ≤ 3 options, select above | |
| Option order | as written in the type declaration | |
| Default values | story `args`, else the input's default | |
| Slot (nested blocks) | an `<ng-content>` in the template (Angular's template parser, also inside `@if`) | Card |
| Drawer category / label | `parameters.puck.category` / `.label` (label defaults to the block name) | |
| Outputs | listed in the manifest; **not wired** (see 6.6) | |

`parameters.puck` reference:

| Key | Type | Purpose |
|---|---|---|
| `category` | `string` | Drawer group (default `"Components"`, with a warning) |
| `label` | `string` | Drawer label (default: block name) |
| `type` | `string` (PascalCase) | Override the block name, e.g. to keep saved pages working after a selector rename |
| `fields` | `{ [input]: 'text' \| 'textarea' \| 'number' \| 'radio' \| 'select' }` | Field kind where inference isn't enough |
| `exclude` | `string[]` | Inputs that should not be editable in Puck |

### 6.4 Rules for components and stories

`puck:verify` enforces these. Errors block generation; warnings don't.

**Errors**
- Story has `meta.component` set to the component class, and the class is exported from the library entry.
- Story `meta` is a **static object literal**: no spreads, function calls or shared objects in
  `tags`, `args`, `argTypes`, `parameters.puck`. (Decorators and render functions are fine; they're
  not read.)
- Selector is a single element selector with the configured prefix; block names and tags are unique.
- Component is standalone.
- Every editable input has a **default**, from story `args` or the input itself.
  `input.required()` needs a story arg.
- Every editable input has a **supported type**: `string`, `number`, `boolean`, or a union of
  string/number literals. Anything else (arrays, objects, templates, functions) must be listed in
  `parameters.puck.exclude`.
- Defaults match the type; `argTypes.options` match the union; `fields` overrides fit the type.
- **No input aliases.**
- At most **one default `<ng-content>`** (no `select=`). An input named like the slot (`content`)
  isn't allowed.
- `parameters.puck` contains only known keys (catches typos like `categroy`).
- No **breaking changes** against the committed manifest, unless acknowledged (6.7).

**Warnings**
- No `category` set.
- The component injects services → they must be provided in `projects/elements/src/main.ts`
  (`puck:smoke` proves it).
- Imports `@angular/router`, extends a base class (inherited inputs aren't seen), uses `hostDirectives`,
  uses `model()`.
- A `text` field with a long default (suggests `textarea`); story `args` that aren't inputs.

### 6.5 Components with `<ng-content>`

Nothing special on the Angular side. `Card` simply has `<ng-content />`. The generator adds a `content`
slot field and renders it as the element's child:

```tsx
render: ({ puck: _puck, id: _id, editMode: _editMode, content: Slot, ...props }) => (
  <apc-card {...props}><Slot /></apc-card>
),
```

This works because a Puck slot renders **one stable wrapper `<div>`**. Angular projects that single
node into `<ng-content>` when the element starts, and React only changes things *inside* the wrapper,
which it still owns.

### 6.6 Outputs and custom behaviour: `overrides.tsx`

Generated blocks don't wire outputs, because mock-ups rarely need them (and Puck intercepts clicks in
the editor anyway). When a block does need custom behaviour, override parts of the generated config in
`composer/src/overrides.tsx`. Everything set there replaces the generated value for that block:

```tsx
export const overrides: BlockOverrides = {
  Button: {
    render: ({ puck, id: _id, editMode: _editMode, ...props }) => <ButtonBlock {...props} editing={puck.isEditing} />,
  },
};
```

`ButtonBlock` listens to the Angular output (a DOM `CustomEvent`) with `useCustomEvent("pressed", …)`
from `composer/src/elements.ts`. Keep overrides rare. Anything expressible in `parameters.puck` belongs
in the story.

### 6.7 Changing components later

Saved pages contain the **block name** (`"Quote"`) and **prop names** (`author`), not HTML. The
generator writes a schema snapshot (`composer/src/generated/puck-manifest.json`), and `puck:verify`
compares it with the committed one (`--base`, default `HEAD`):

| Change | Effect on saved pages | `puck:verify` |
|---|---|---|
| Styling / markup | none | ✓ |
| New input | old pages don't have it → the input's own default applies | ✓ |
| New option in a union | none | ✓ |
| Renamed/removed input, removed option, changed type, removed slot, renamed block | old pages hold stale data | ✗ error |

For an intentional breaking change: migrate the saved page JSON (or map old data in Puck's
`resolveData`), then run `pnpm puck:verify --allow-breaking` to acknowledge it. To rename a selector
without breaking pages, pin the old block name with `parameters.puck.type`.

---

## 7. The `puck:*` scripts

All are plain Node ESM in `scripts/puck/` and share one analysis module, so they can't disagree about
what's supported. Settings live in `scripts/puck/config.mjs`.

| Script | What it does | Exit code | Typical use |
|---|---|---|---|
| `pnpm puck:verify [Name…]` | Static checks per component/story (6.4), generated files up to date, breaking changes vs `--base` (default `HEAD`). Names are block or class names. Options: `--base <git-ref>`, `--allow-breaking` | 1 on any error | while writing a story; before committing |
| `pnpm puck:generate` | **Always regenerates everything** (sorted, Prettier-formatted, deterministic). Refuses to write if any story has errors | 1 on errors | after adding/changing a component or story |
| `pnpm puck:check` | Same as generate, but only compares with the committed files | 1 if stale | CI |
| `pnpm puck:smoke` | Starts the built composer on a free port with a temp data dir, renders a page containing **every block with its defaults** in headless Chromium, checks each element rendered, every block is in the editor drawer, and there are no page errors | 1 on any failure | after `pnpm build:elements && pnpm build:composer`; catches missing providers and runtime breakage |

`puck:smoke` needs Chromium once: `pnpm exec playwright install chromium`, or set
`CHROMIUM_PATH=/path/to/chrome` to use an existing binary.

Example output of `pnpm puck:verify`:

```
Components
✓ Alert          Alert → <apc-alert>
✓ Card           Card → <apc-card>
…
✓ Text           TextBlock → <apc-text>

  not in Puck (no 'puck' tag): dashboard.stories.ts

Generated files
✓ up to date

Saved-page compatibility (vs HEAD)
✓ no breaking changes

✓ all checks passed
```

---

## 8. Running the checks in CI

For now everything runs manually. Once there is a pipeline, the scripts are built for it: they are
non-interactive, deterministic and use exit codes. Recommended order, cheapest first:

```sh
pnpm install --frozen-lockfile
pnpm puck:check                                  # generated files committed & current (seconds)
pnpm puck:verify --base origin/main              # rules + breaking changes vs the target branch (seconds)
pnpm test --watch=false                          # library unit tests
pnpm build:elements && pnpm build:composer       # also type-checks the generated code
pnpm build:storybook
pnpm exec playwright install --with-deps chromium
pnpm puck:smoke                                  # runtime check of every block (~1 min)
docker compose build                             # on main / release only
```

Notes:
- **Don't run `puck:generate` in CI.** Generated files are committed so reviews show exactly what
  changed for Puck; CI only proves they're current (`puck:check`). A pipeline that silently
  regenerates would hide stale or unintended output.
- `--base` should be the **target branch** of the merge request (fetch it first; shallow clones need
  enough history for `git show <base>:…`). Breaking changes then fail the pipeline until someone
  migrates saved pages and acknowledges with `--allow-breaking`. That's best done as a deliberate,
  reviewed change (e.g. a manual CI job or a label), not a default flag.
- `puck:smoke` is the slowest step and needs a browser. If pipeline time matters, run it on merge
  requests that touch `projects/ui/`, `projects/elements/` or `composer/`, and always on main.
- Fast local feedback: run `pnpm puck:verify` as a pre-commit hook (e.g. via husky/lefthook) once
  hooks are in use.

---

## 9. Design decisions

**Generate everything, every time, from an opt-in tag.** Partial or per-component generation leaves
stale entries behind after deletes and renames; a full, deterministic regeneration can't drift, and
enables `puck:check`. Opting in through a Storybook tag keeps components that aren't meant for mock-ups
(router-bound, data-fetching) out of the drawer.

**Static analysis only.** The TypeScript checker and Angular's template parser are public, stable
APIs and resolve real types (aliases, unions, `booleanAttribute` transforms). Stories must therefore be
static literals; that's the one constraint on how stories are written.

**Unknown means error, never a guess.** Unsupported types, aliases, multi-slot projection and dynamic
story values stop generation with a specific message instead of producing a block that half works.

**Block names come from selectors, option order from the source.** Selectors change less often than
class names, and the TypeScript checker's internal union order depends on file load order. Using the
written order keeps the output stable, so `puck:check` doesn't flag unrelated changes.

**Providers stay hand-written.** What a component injects at runtime can't be inferred reliably, so
`projects/elements/src/main.ts` keeps them; the verifier warns, `puck:smoke` proves it.

**Puck's iframe is disabled.** Custom element definitions are per window, so elements registered in the
page wouldn't exist inside Puck's canvas iframe. The iframe only buys correct mobile/tablet previews and
CSS isolation. The product is desktop-only, so there's a single `Desktop` viewport.

**Custom element tags (`apc-*`) differ from selectors (`ui-*`).** If they were equal, the `<ui-button>`
that Angular renders inside `<ui-hero>` would also be upgraded as a custom element and render twice.

**`@puckeditor/core/no-external.css`.** The default `puck.css` imports the Inter webfont from rsms.me;
this variant keeps the composer offline-capable.

**pnpm 12 supply-chain policy stays on.** Packages younger than 24h are refused
(`minimumReleaseAge`); widen a version range instead of disabling the policy.

---

## 10. Docker & Docker Swarm

| Image | Runtime | Size | State |
|---|---|---|---|
| `composer` | `node:24-alpine` + `server/` (no node_modules) + built composer incl. `/elements` | ~245 MB | JSON files in `/data` |
| `storybook` | `nginx:alpine` + static Storybook | ~115 MB | none |

Both have a `HEALTHCHECK`. The composer runs as the non-root `node` user. The image build does **not**
regenerate the Puck integration; it uses the generated files in the repo, so run `pnpm puck:generate`
before building.

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
  locking. For HA, use shared storage or swap `server/store.mjs` for a database.
- **Storybook:** stateless, 2 replicas, rolling `start-first` updates.
- **No auth built in.** Put the stack behind your reverse proxy with SSO/basic auth. Restrict `/edit/*`
  and `PUT /api/pages/*` to devs; `/view/*` is the management link.
- Everything works offline at runtime: no CDNs, Storybook telemetry off, Puck without external fonts.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A component isn't in the Puck drawer | Story lacks the `puck` tag, or files not regenerated/rebuilt | `pnpm puck:verify` lists untagged stories; `pnpm puck:generate`; rebuild/reload |
| `puck:generate` says *nothing generated* | A story/component breaks a rule | `pnpm puck:verify` shows the reason per component |
| *meta.args must be static* | Spread, variable or function in the story's `meta` | Write the values inline |
| *type "X" can't be edited in Puck* | Array/object/template input | `parameters.puck.exclude: ['name']` |
| *out of date* in `puck:verify`/`puck:check` | Stories or components changed without regenerating | `pnpm puck:generate` and commit |
| *out of date* on Windows right after cloning | CRLF checkout from before `.gitattributes` existed | Commit/stash, then `git rm -r -q --cached .; git reset --hard` ([3.1](#31-windows)) |
| PowerShell: *running scripts is disabled on this system* | Default execution policy `Restricted` | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| *X.y was removed or renamed* | Breaking change for saved pages | Migrate pages, then `--allow-breaking`; or keep the old name (`parameters.puck.type`) |
| `puck:smoke`: *element is empty* + `NG0201` | Component injects something the elements app doesn't provide | Add the provider in `projects/elements/src/main.ts` |
| `puck:smoke`: *composer/dist/elements/main.js missing* | No build | `pnpm build:elements && pnpm build:composer` |
| `puck:smoke`: browser not found | Playwright's Chromium not installed | `pnpm exec playwright install chromium` or `CHROMIUM_PATH=…` |
| Composer shows *Could not load /elements/main.js* | Bundle not built | `pnpm build:elements` (or `pnpm dev`) |
| Component renders twice inside itself | Custom element tag equals a component selector | Keep `tagPrefix` ≠ `selectorPrefix` |
| Component unstyled in Puck but fine in Storybook | Global CSS only in Storybook's `styles` | Add it to the elements target's `styles` |
| Puck's sidebars change font/buttons | Unscoped global selectors in your CSS | Scope them under a wrapper class |
| Component doesn't update after a field edit | Zone-dependent change detection in a zoneless build | Signal/OnPush, or add `zone.js` to the elements polyfills |
| `pnpm install`: *within the minimumReleaseAge cutoff* | A package version is under 24h old | Wait, or widen the range to the previous patch |
| `pnpm install`: *Ignored build scripts* | pnpm ≥ 11 blocks build scripts | Add them to `allowBuilds` in `pnpm-workspace.yaml` |
| Storybook fails with an error mentioning `@angular-devkit/build-angular` | Storybook's Angular builder needs it | `pnpm add -D @angular-devkit/build-angular@<your major>` |

---

## 12. Known limitations

- **Generator scope:** inputs with array/object/template types can only be excluded, not edited.
  Multi-slot projection (`<ng-content select>`), inherited inputs, host-directive inputs and input
  aliases aren't supported yet. All are reported, never silently mishandled.
- **Outputs aren't wired automatically.** Use `overrides.tsx` where a mock-up needs them.
- **Providers are hand-written** in `projects/elements/src/main.ts`; `puck:smoke` is the safety net.
- **Puck is 0.x** (0.23 here). Minor versions can break things, so pin it and upgrade deliberately.
  MIT, so you could fork it.
- **Editor and components share one document** (no iframe), so CSS hygiene matters (5.5).
- **The page server has no authentication, versioning or concurrent-edit protection**; last save wins.
- **Save image** rasterizes the DOM in the browser (`html-to-image`). Images from other origins only
  appear if they're served with CORS headers. Pages taller than ~8,000 px are exported at a lower pixel
  ratio, since browsers cap canvas size at ~16k px per side (`MAX_SIDE` in `composer/src/save-image.tsx`).
- Tested with Angular 22, Storybook 10.6, Puck 0.23, React 19, Chromium only; on Linux and Windows 11.
