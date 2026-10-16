import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Button } from './button';

@Component({
  selector: 'ui-navbar',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nav">
      <span class="nav__brand">{{ brand() }}</span>
      <div class="nav__links">
        @for (item of items(); track item) { <a href="#" (click)="$event.preventDefault()">{{ item }}</a> }
      </div>
      @if (ctaLabel()) { <ui-button [label]="ctaLabel()" size="sm" /> }
    </nav>
  `,
  styles: `
    :host { display: block; }
    .nav { display: flex; align-items: center; gap: 24px; padding: 14px 24px; border-bottom: 1px solid var(--ui-border); }
    .nav__brand { font-weight: 800; font-size: 1.1rem; }
    .nav__links { display: flex; gap: 18px; flex: 1; }
    .nav__links a { color: var(--ui-muted); text-decoration: none; }
    .nav__links a:hover { color: var(--ui-text); }
  `,
})
export class Navbar {
  readonly brand = input('Brand');
  /** Comma separated, so editors can expose it as one text field. */
  readonly links = input('');
  readonly ctaLabel = input('');
  protected readonly items = computed(() => this.links().split(',').map((l) => l.trim()).filter(Boolean));
}
