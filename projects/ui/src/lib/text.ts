import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p [class]="'text text--' + size()" [class.text--muted]="muted()">{{ text() }}</p>`,
  styles: `
    :host { display: block; }
    .text { margin: 0; }
    .text--sm { font-size: .875rem; } .text--lg { font-size: 1.15rem; }
    .text--muted { color: var(--ui-muted); }
  `,
})
export class TextBlock {
  readonly text = input('Text');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly muted = input(false, { transform: booleanAttribute });
}
