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
    blockquote { margin: 0 0 8px; font-size: 1.2rem; font-style: italic; }
    figcaption { color: var(--ui-muted); font-size: .9rem; }
  `,
})
export class Quote {
  readonly text = input('Quote text');
  readonly author = input('');
  readonly role = input('');
}
