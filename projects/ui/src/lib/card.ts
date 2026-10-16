import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Badge } from './badge';
import type { Tone } from './tone';

/**
 * Has an <ng-content> slot: this is the component that tests whether content projection survives
 * being driven by React/Puck as a custom element (see README "Content projection").
 */
@Component({
  selector: 'ui-card',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      @if (badge()) { <div><ui-badge [label]="badge()" [tone]="badgeTone()" /></div> }
      <h3 class="card__title">{{ title() }}</h3>
      @if (body()) { <p class="card__body">{{ body() }}</p> }
      <ng-content />
      @if (footer()) { <div class="card__footer">{{ footer() }}</div> }
    </article>
  `,
  styles: `
    :host { display: block; }
    .card { height: 100%; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .card__title { margin: 0; font-size: 1.1rem; }
    .card__body { margin: 0; color: var(--ui-muted); }
    .card__footer { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--ui-border); color: var(--ui-muted); font-size: .875rem; }
  `,
})
export class Card {
  readonly title = input('Card');
  readonly body = input('');
  readonly badge = input('');
  readonly badgeTone = input<Tone>('info');
  readonly footer = input('');
}
