import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';
import { Card } from './card';
import { StatCard } from './stat-card';

describe('@apc/ui', () => {
  it('StatCard renders its inputs', async () => {
    const fixture = TestBed.createComponent(StatCard);
    fixture.componentRef.setInput('label', 'Revenue');
    fixture.componentRef.setInput('value', '€312k');
    fixture.componentRef.setInput('delta', '4%');
    fixture.componentRef.setInput('trend', 'up');
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Revenue');
    expect(text).toContain('€312k');
    expect(text).toContain('▲ 4%');
  });

  it('Card projects content between title and footer', async () => {
    @Component({
      imports: [Card],
      template: `<ui-card title="T" footer="F"><p class="projected">inside</p></ui-card>`,
    })
    class Host {}
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const projected = el.querySelector('article.card .projected');
    expect(projected).not.toBeNull();
    const footer = el.querySelector('.card__footer')!;
    expect(projected!.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Button emits pressed on click', async () => {
    const fixture = TestBed.createComponent(Button);
    let pressed = 0;
    fixture.componentInstance.pressed.subscribe(() => pressed++);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(pressed).toBe(1);
  });
});
