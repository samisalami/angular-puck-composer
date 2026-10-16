import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from './button';

@Component({
  selector: 'ui-hero',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="hero">
      @if (eyebrow()) { <span class="hero__eyebrow">{{ eyebrow() }}</span> }
      <h1 class="hero__title">{{ title() }}</h1>
      @if (subtitle()) { <p class="hero__subtitle">{{ subtitle() }}</p> }
      <div class="hero__actions">
        @if (primaryCta()) { <ui-button [label]="primaryCta()" size="lg" (pressed)="ctaClick.emit('primary')" /> }
        @if (secondaryCta()) { <ui-button [label]="secondaryCta()" size="lg" variant="secondary" (pressed)="ctaClick.emit('secondary')" /> }
      </div>
    </header>
  `,
  styles: `
    :host { display: block; }
    .hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 72px 24px; }
    .hero__eyebrow { text-transform: uppercase; letter-spacing: .1em; font-size: .8rem; font-weight: 700; color: var(--ui-primary); }
    .hero__title { font-size: 3rem; line-height: 1.1; margin: 0; max-width: 18ch; }
    .hero__subtitle { font-size: 1.2rem; color: var(--ui-muted); max-width: 52ch; margin: 0; }
    .hero__actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  `,
})
export class Hero {
  readonly eyebrow = input('');
  readonly title = input('Headline');
  readonly subtitle = input('');
  readonly primaryCta = input('');
  readonly secondaryCta = input('');
  readonly ctaClick = output<'primary' | 'secondary'>();
}
