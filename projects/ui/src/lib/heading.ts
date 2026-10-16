import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (level()) {
      @case (1) { <h1 [style.text-align]="align()">{{ text() }}</h1> }
      @case (3) { <h3 [style.text-align]="align()">{{ text() }}</h3> }
      @case (4) { <h4 [style.text-align]="align()">{{ text() }}</h4> }
      @default { <h2 [style.text-align]="align()">{{ text() }}</h2> }
    }
  `,
  styles: `
    :host { display: block; }
    h1, h2, h3, h4 { margin: 0; line-height: 1.2; font-weight: 700; }
    h1 { font-size: 2.5rem; } h2 { font-size: 1.9rem; } h3 { font-size: 1.4rem; } h4 { font-size: 1.1rem; }
  `,
})
export class Heading {
  readonly text = input('Heading');
  readonly level = input<1 | 2 | 3 | 4>(2);
  readonly align = input<'left' | 'center' | 'right'>('left');
}
