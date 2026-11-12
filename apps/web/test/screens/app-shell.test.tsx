import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '../render';

afterEach(() => {
  cleanup();
  setViewport(1440, 900);
});

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('AppShell chrome', () => {
  beforeEach(() => {
    setViewport(1440, 900);
  });

  it('keeps marketing Main nav on desktop', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Werewolf' })).toBeTruthy();
    const app = document.querySelector('.ww-app');
    expect(app?.getAttribute('data-chrome')).toBe('marketing');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.textContent).toContain('Play');
    expect(nav.textContent).toContain('How to Play');
    expect(nav.textContent).toContain('Roles');
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('uses session chrome on phone portrait', async () => {
    setViewport(390, 844);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Werewolf' })).toBeTruthy();
    const app = document.querySelector('.ww-app');
    expect(app?.getAttribute('data-chrome')).toBe('session');
    expect(app?.getAttribute('data-layout')).toBe('portrait');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Play' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'How to Play' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Roles' })).toBeTruthy();
  });

  it('uses session chrome on phone landscape', async () => {
    setViewport(844, 390);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Werewolf' })).toBeTruthy();
    expect(document.querySelector('.ww-app')?.getAttribute('data-chrome')).toBe('session');
    expect(document.querySelector('.ww-app')?.getAttribute('data-layout')).toBe('phone-landscape');
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });
});
