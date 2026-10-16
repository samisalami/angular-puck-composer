import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

@Component({
  selector: 'ui-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [title]="name()" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4">
      {{ initials() }}
    </span>
  `,
  styles: `
    :host { display: inline-block; }
    .avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ui-primary); color: var(--ui-primary-text); font-weight: 700; }
  `,
})
export class Avatar {
  readonly name = input('Ada Lovelace');
  readonly size = input(40, { transform: numberAttribute });
  protected readonly initials = computed(() =>
    this.name().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase(),
  );
}
