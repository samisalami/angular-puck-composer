import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Tone } from './tone';

@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge badge--' + tone()">{{ label() }}</span>`,
  styles: `
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 600; color: #fff; background: var(--ui-muted); }
    .badge--success { background: var(--ui-success); }
    .badge--warning { background: var(--ui-warning); }
    .badge--danger { background: var(--ui-danger); }
    .badge--info { background: var(--ui-info); }
  `,
})
export class Badge {
  readonly label = input('Badge');
  readonly tone = input<Tone>('neutral');
}
