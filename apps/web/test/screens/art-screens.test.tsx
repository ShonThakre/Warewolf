import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerAvatar } from '../../src/game/components/PlayerAvatar';
import { VictoryBanner } from '../../src/game/components/VictoryBanner';

afterEach(cleanup);

describe('avatar art', () => {
  it('uses the portrait when the file exists and initials when it does not', () => {
    const { rerender } = render(<PlayerAvatar name="Asha" avatarId={1} />);
    expect(document.querySelector('.ww-avatar-img')).toBeTruthy();
    expect(document.querySelector('.ww-avatar')?.textContent).toBe('');

    rerender(<PlayerAvatar name="Asha" avatarId={null} />);
    expect(document.querySelector('.ww-avatar-img')).toBeNull();
    expect(screen.getByText('AS')).toBeTruthy();
  });

  it('uses the mystery portrait for an empty seat', () => {
    render(<PlayerAvatar name="Empty" empty />);
    expect(document.querySelector('.ww-avatar-img')).toBeTruthy();
  });
});

describe('victory banner', () => {
  it('shows the title without a scene until an outcome is known', () => {
    render(<VictoryBanner title="Waiting for the result" reason="The ribbon appears with the result." />);
    expect(screen.getByRole('heading', { name: 'Waiting for the result' })).toBeTruthy();
    expect(document.querySelector('.ww-victory-scene')).toBeNull();
  });

  it('paints the village scene and ribbon behind the title', () => {
    render(<VictoryBanner outcome="village" title="The village wins" reason="The wolves were found." />);
    expect(screen.getByRole('heading', { name: 'The village wins' })).toBeTruthy();
    expect(document.querySelector('.ww-victory-scene img')).toBeTruthy();
    expect(document.querySelector('.ww-victory-ribbon')).toBeTruthy();
    expect(document.body.textContent).not.toContain('victory_village');
  });
});
