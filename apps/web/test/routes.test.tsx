import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { tokens, tokensToCss } from '../src/theme/tokens';
import { renderApp } from './render';

function renderAt(path: string) {
  renderApp(path);
}

afterEach(cleanup);

describe('router placeholders', () => {
  it.each([
    ['/', 'Werewolf'],
    ['/roles', 'Role catalog'],
    ['/how-to-play', 'How to play'],
    ['/game/g1/results', 'Werewolf'],
    ['/game/g1/host', 'Werewolf'],
  ])('%s renders %s', async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
  });

  it('renders a not-found page for unknown paths', () => {
    renderAt('/nowhere');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('has the shared top navigation', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.textContent).toContain('Play');
    expect(nav.textContent).toContain('How to Play');
    expect(nav.textContent).toContain('Roles');
  });
});

describe('theme tokens', () => {
  it('writes every token to :root', () => {
    const css = tokensToCss();
    for (const [name, value] of Object.entries(tokens)) expect(css).toContain(`${name}: ${value};`);
    expect(css).toContain('--bg: #140b22;');
  });
});
