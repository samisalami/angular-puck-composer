import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat">
      <span class="stat__label">{{ label() }}</span>
      <span class="stat__value">{{ value() }}</span>
      @if (delta()) { <span [class]="'stat__delta stat__delta--' + trend()">{{ arrow() }} {{ delta() }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .stat { background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 20px; display: flex; flex-direction: column; gap: 4px; }
    .stat__label { font-size: .875rem; color: var(--ui-muted); }
    .stat__value { font-size: 2rem; font-weight: 700; }
    .stat__delta { font-size: .875rem; }
    .stat__delta--up { color: var(--ui-success); } .stat__delta--down { color: var(--ui-danger); } .stat__delta--flat { color: var(--ui-muted); }
  `,
})
export class StatCard {
  readonly label = input('Metric');
  readonly value = input('0');
  readonly delta = input('');
  readonly trend = input<'up' | 'down' | 'flat'>('flat');
  protected readonly arrow = computed(() => ({ up: '▲', down: '▼', flat: '■' })[this.trend()]);
}
