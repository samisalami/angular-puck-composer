import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
// Tag → component map, generated from the stories tagged 'puck' (pnpm puck:generate).
import { elements } from './elements.generated';

/**
 * Builds the @apc/ui components as standard Web Components (custom elements) so non-Angular
 * hosts - here the React/Puck composer - can render them.
 *
 * Tag names use the `apc-` prefix on purpose: if a custom element had the same name as a component
 * selector (`ui-button`), the `<ui-button>` that Angular renders inside e.g. <ui-hero> would get
 * upgraded as a custom element too and render a second Button inside itself.
 */

// Angular 22 is zoneless by default: input changes made through the element's properties
// are signal writes, which schedule change detection on their own.
// Hand-written on purpose: services the components inject can't be inferred by the generator.
// Add them here (e.g. provideHttpClient(), translation providers); `pnpm puck:smoke` catches gaps.
const app = await createApplication({ providers: [provideBrowserGlobalErrorListeners()] });

for (const [tag, component] of Object.entries(elements)) {
  if (!customElements.get(tag)) {
    customElements.define(tag, createCustomElement(component, { injector: app.injector }));
  }
}

// Tell the host page (the composer) that every element is defined. Exposed as a global too, so a host
// that loads late doesn't miss the event. Hosts don't need their own copy of the tag list.
declare global {
  interface Window {
    apcElements?: string[];
  }
}
window.apcElements = Object.keys(elements);
document.dispatchEvent(new CustomEvent('apc-elements-ready', { detail: window.apcElements }));
