import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { routes } from '../src/routes';
import { tokens, tokensToCss } from '../src/theme/tokens';

function renderAt(path: string) {
  render(<App router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

afterEach(cleanup);

describe('router placeholders', () => {
  it.each([
    ['/', 'Home'],
    ['/roles', 'Role catalog'],
    ['/how-to-play', 'How to play'],
    ['/lobby/g1', 'Lobby'],
    ['/game/g1/reveal', 'Role reveal'],
    ['/game/g1', 'Game table'],
    ['/game/g1/host', 'Host dashboard'],
    ['/game/g1/results', 'Results'],
  ])('%s renders %s', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  });

  it('shows the game id on game routes', () => {
    renderAt('/game/abc123');
    expect(screen.getByText('Game abc123')).toBeTruthy();
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
