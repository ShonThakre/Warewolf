import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '../render';

afterEach(cleanup);

describe('role catalog', () => {
  it('filters by team, searches, and keeps an unresolved role closed', async () => {
    renderApp('/roles');
    expect(await screen.findByRole('heading', { name: 'Role catalog' })).toBeTruthy();
    const teams = screen.getByRole('group', { name: 'Teams' });
    fireEvent.click(within(teams).getByRole('button', { name: 'Wolf' }));
    expect(screen.getByRole('button', { name: /Alpha Wolf/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Villager/ })).toBeNull();

    fireEvent.click(within(teams).getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search roles' }), { target: { value: 'Alpha Wolf' } });
    expect(screen.getByRole('button', { name: /Alpha Wolf/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Villager/ })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search roles' }), { target: { value: '' } });
    const locked = screen.getByRole('button', { name: /Confuser/ });
    expect(locked.hasAttribute('disabled')).toBe(true);
    expect(locked.textContent).toContain('OD-18');

    fireEvent.click(screen.getByRole('button', { name: /Alpha Wolf/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Alpha Wolf' });
    expect(within(dialog).getByText('Team: Wolf')).toBeTruthy();
    expect(dialog.textContent).not.toContain('alpha_wolf');
  });
});
