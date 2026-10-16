import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'alert alert--' + tone()" role="status">
      <p class="alert__title">{{ title() }}</p>
      @if (message()) { <p class="alert__message">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .alert { border-left: 4px solid var(--ui-info); background: var(--ui-surface); padding: 12px 16px; border-radius: 6px; }
    .alert--success { border-color: var(--ui-success); } .alert--warning { border-color: var(--ui-warning); } .alert--danger { border-color: var(--ui-danger); }
    .alert__title { font-weight: 700; margin: 0 0 2px; }
    .alert__message { margin: 0; font-size: .875rem; }
  `,
})
export class Alert {
  readonly title = input('Alert');
  readonly message = input('');
  readonly tone = input<'info' | 'success' | 'warning' | 'danger'>('info');
}
