import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="'btn btn--' + variant() + ' btn--' + size()" (click)="pressed.emit()">
      {{ label() }}
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    .btn { font: inherit; font-weight: 600; cursor: pointer; border-radius: var(--ui-radius); border: 1px solid transparent; }
    .btn:hover { filter: brightness(1.08); }
    .btn--sm { padding: 4px 10px; font-size: .85rem; }
    .btn--md { padding: 8px 16px; }
    .btn--lg { padding: 12px 22px; font-size: 1.05rem; }
    .btn--primary { background: var(--ui-primary); color: var(--ui-primary-text); }
    .btn--secondary { background: transparent; color: var(--ui-text); border-color: var(--ui-border); }
    .btn--ghost { background: transparent; color: var(--ui-primary); }
  `,
})
export class Button {
  readonly label = input('Button');
  readonly variant = input<'primary' | 'secondary' | 'ghost'>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Becomes a DOM CustomEvent named "pressed" when used as a custom element. */
  readonly pressed = output<void>();
}
