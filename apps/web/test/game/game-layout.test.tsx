import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { lobbyProjectionSchema } from '@warewolf/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { lobbyFixture, tableSeatsFixture } from '../../src/game/fixtures/lobby';
import {
  GameLayout,
  NARROW_LANDSCAPE_CHECK,
  PRIORITY_VIEWPORTS,
  STAGE_MODES,
  layoutInfo,
  type GameLayoutProps,
  type StageMode,
} from '../../src/game/layout';
import { renderApp } from '../render';

const ALL_VIEWPORTS = [...PRIORITY_VIEWPORTS, NARROW_LANDSCAPE_CHECK];

function renderLayout(stage: StageMode, size: { width: number; height: number } | null, extra: Partial<GameLayoutProps> = {}) {
  return render(
    <GameLayout
      stage={stage}
      status={<h1>Night 2</h1>}
      scene={<div data-testid="scene" />}
      foreground={<ul aria-label="Choose a player"><li>Rafi</li></ul>}
      rail={<p>Event log</p>}
      action={<button type="button">Submit</button>}
      {...(size ? { layout: layoutInfo(size.width, size.height) } : {})}
      {...extra}
    />,
  );
}

const root = () => document.querySelector<HTMLElement>('.ww-game-layout')!;

afterEach(cleanup);

describe('GameLayout regions', () => {
  it.each(ALL_VIEWPORTS.flatMap((v) => STAGE_MODES.map((s) => [v.project, `${v.width}×${v.height}`, s, v] as const)))(
    '%s %s %s: status, stage, and action are named and on screen',
    (_project, _size, stage, v) => {
      renderLayout(stage, v);
      expect(screen.getByRole('region', { name: 'Game status' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Village' })).toBeTruthy();
      const action = screen.getByRole('region', { name: 'Actions' });
      expect(within(action).getByRole('button', { name: 'Submit' })).toBeTruthy();
      expect(root().dataset).toMatchObject({ layout: v.mode, stage });
    },
  );

  it.each(PRIORITY_VIEWPORTS.filter((v) => v.mode !== 'portrait').map((v) => [v.project, v] as const))(
    '%s shows the rail beside the stage, with the foreground in the stage',
    (_project, v) => {
      renderLayout('night', v);
      expect(within(screen.getByRole('region', { name: 'Room' })).getByText('Event log')).toBeTruthy();
      expect(within(screen.getByRole('region', { name: 'Village' })).getByRole('list', { name: 'Choose a player' })).toBeTruthy();
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Room' })).toBeNull();
    },
  );

  it('takes custom region names', () => {
    renderLayout('day', { width: 1920, height: 1080 }, { labels: { rail: 'Discussion', stage: 'Town square' } });
    expect(screen.getByRole('region', { name: 'Discussion' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Town square' })).toBeTruthy();
  });

  it('marks the stage wash and foreground for the stylesheet', () => {
    renderLayout('voting', { width: 1440, height: 900 });
    expect(root().dataset).toMatchObject({ wash: 'day', foreground: 'player-grid', statusRow: 'true' });
    cleanup();
    renderLayout('night', { width: 915, height: 412 });
    expect(root().dataset).toMatchObject({ wash: 'night', statusRow: 'false' });
  });
});

describe('narrow landscape', () => {
  it('collapses the rail to a button that opens and closes it', () => {
    renderLayout('night', NARROW_LANDSCAPE_CHECK);
    const toggle = screen.getByRole('button', { name: 'Room' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Room' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const rail = screen.getByRole('region', { name: 'Room' });
    expect(toggle.getAttribute('aria-controls')).toBe(rail.id);
    expect(root().dataset['railOpen']).toBe('true');
    // The action row stays while the rail is open.
    expect(screen.getByRole('region', { name: 'Actions' })).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByRole('region', { name: 'Room' })).toBeNull();
  });

  it('closes the open rail on Escape and returns focus to the toggle', () => {
    renderLayout('day', NARROW_LANDSCAPE_CHECK);
    const toggle = screen.getByRole('button', { name: 'Room' });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByText('Event log'), { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});

describe('portrait', () => {
  const portrait = { width: 390, height: 844 };

  it('puts a target grid under a Players switch that shares the middle with the rail', () => {
    renderLayout('night', portrait);
    const tabs = screen.getByRole('tablist', { name: 'Show' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Players', 'Room']);
    expect(screen.getByRole('tabpanel', { name: 'Players' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Room' })).toBeNull();
    // The grid moved out of the stage.
    expect(within(screen.getByRole('region', { name: 'Village' })).queryByRole('list')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Room' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Room' })).getByText('Event log')).toBeTruthy();
    // Switching hides the grid; it does not unmount it, and the action row stays.
    expect(screen.queryByRole('tabpanel', { name: 'Players' })).toBeNull();
    expect(screen.getByText('Rafi', { selector: 'li' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Actions' })).toBeTruthy();
  });

  it('keeps avatars in the scene and shows the rail in the middle, with no switch', () => {
    renderLayout('lobby', portrait, { foreground: <ul aria-label="Seated players"><li>Asha</li></ul> });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Village' })).getByRole('list', { name: 'Seated players' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Room' })).toBeTruthy();
  });

  it('has no switch when a grid stage has nothing to show yet', () => {
    renderLayout('voting', portrait, { foreground: undefined });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('region', { name: 'Room' })).toBeTruthy();
  });
});

describe('measured viewport', () => {
  function resize(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
  }

  it('follows the window size, including rotation', () => {
    const before = { width: window.innerWidth, height: window.innerHeight };
    try {
      resize(1920, 1080);
      renderLayout('night', null);
      expect(root().dataset['layout']).toBe('full');
      act(() => resize(844, 390));
      expect(root().dataset['layout']).toBe('phone-landscape');
      act(() => resize(390, 844));
      expect(root().dataset['layout']).toBe('portrait');
      expect(screen.getByRole('tablist', { name: 'Show' })).toBeTruthy();
    } finally {
      resize(before.width, before.height);
    }
  });
});

describe('fixtures and preview', () => {
  it('the lobby fixture matches the lobby contract', () => {
    expect(lobbyProjectionSchema.parse(lobbyFixture())).toEqual(lobbyFixture());
    expect(lobbyFixture().start).toEqual({ ready: true, blockers: [], requiresWarningAcknowledgement: false });
    expect(lobbyFixture({ seated: 5 }).start.blockers).toEqual(['SEATS_OPEN']);
    expect(lobbyFixture({ status: 'ACTIVE' })).toMatchObject({ phase: 'ROLE_REVEAL', start: { blockers: ['NOT_LOBBY'] } });
  });

  it('the table fixture has dead seats to show', () => {
    const seats = tableSeatsFixture();
    expect(seats).toHaveLength(20);
    expect(seats.filter((s) => s.lifeStatus === 'DEAD').map((s) => s.seatNumber)).toEqual([6, 13]);
  });

  it('the dev preview lists every stage', async () => {
    renderApp('/dev/layout');
    const nav = await screen.findByRole('navigation', { name: 'Layout previews' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([...STAGE_MODES]);
  });

  it('the dev preview renders a stage in GameLayout with dead seats disabled', async () => {
    renderApp('/dev/layout/night');
    expect(await screen.findByRole('region', { name: 'Actions' })).toBeTruthy();
    expect(root().dataset['stage']).toBe('night');
    const dead = tableSeatsFixture().find((s) => s.lifeStatus === 'DEAD')!;
    expect((screen.getByRole('button', { name: dead.displayName }) as HTMLButtonElement).disabled).toBe(true);
  });
});
