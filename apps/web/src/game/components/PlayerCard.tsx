import type { ReactNode } from 'react';
import { PlayerAvatar } from './PlayerAvatar';

export interface PlayerCardProps {
  name: string;
  seatNumber: number;
  host: boolean;
  you: boolean;
  avatarId?: number | null;
  actions?: ReactNode;
}

/** Public seat. Roles are not dealt in the lobby, so life is Alive and no team is shown. */
export function PlayerCard({ name, seatNumber, host, you, avatarId = null, actions }: PlayerCardProps) {
  const detail = [`Seat ${seatNumber}`, 'Alive', host ? 'Host' : null, you ? 'You' : null].filter(Boolean).join(' · ');
  return (
    <article className="ww-player" aria-label={`${name}, ${detail}`}>
      <PlayerAvatar name={name} avatarId={avatarId} />
      <div className="ww-player-copy">
        <p className="ww-player-name">{name}</p>
        <p className="ww-player-meta">{detail}</p>
      </div>
      {actions ? <div className="ww-player-actions">{actions}</div> : null}
    </article>
  );
}
