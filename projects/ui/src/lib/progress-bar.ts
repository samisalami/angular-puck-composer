import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

@Component({
  selector: 'ui-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress__label"><span>{{ label() }}</span><span>{{ pct() }}%</span></div>
    <div class="progress__track"><div class="progress__bar" [style.width.%]="pct()"></div></div>
  `,
  styles: `
    :host { display: block; }
    .progress__label { display: flex; justify-content: space-between; font-size: .875rem; margin-bottom: 4px; }
    .progress__track { height: 8px; background: var(--ui-border); border-radius: 999px; overflow: hidden; }
    .progress__bar { height: 100%; background: var(--ui-primary); }
  `,
})
export class ProgressBar {
  readonly label = input('Progress');
  readonly value = input(0, { transform: numberAttribute });
  protected readonly pct = computed(() => Math.max(0, Math.min(100, this.value())));
}
