import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RolePortrait } from '../../src/game/components/RolePortrait';
import { cleanRoomCode } from '../../src/game/components/SeatDialogs';

afterEach(cleanup);

describe('role portrait', () => {
  it('shows the art, and a team crest with initials when the image fails', () => {
    const { container } = render(<RolePortrait roleId="alpha_wolf" name="Alpha Wolf" faction="WOLF_PACK" />);
    const well = container.querySelector('.ww-portrait');
    expect(well?.getAttribute('data-art')).toBe('image');
    fireEvent.error(container.querySelector('img')!);
    expect(well?.getAttribute('data-art')).toBe('fallback');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.ww-portrait-mono')?.textContent).toBe('AW');
  });

  it('falls back for a role with no art file', () => {
    const { container } = render(<RolePortrait roleId="no_such_role" name="Night Owl" faction="NEUTRAL" />);
    expect(container.querySelector('.ww-portrait')?.getAttribute('data-art')).toBe('fallback');
  });
});

describe('room code input', () => {
  it('uppercases and drops spaces and dashes from a pasted code', () => {
    expect(cleanRoomCode('k7q-mpr')).toBe('K7QMPR');
    expect(cleanRoomCode(' K7Q MPR X ')).toBe('K7QMPR');
  });
});
