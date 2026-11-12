import type { LobbyPlayer } from '@warewolf/contracts';
import type { ReactNode } from 'react';
import { PlayerAvatar } from './PlayerAvatar';

export interface PlayerCardProps {
  name: string;
  seatNumber: number;
  host: boolean;
  you: boolean;
  avatarId?: number | null;
  connectionStatus: LobbyPlayer['connectionStatus'];
  actions?: ReactNode;
}

/** Public seat. Roles are not dealt in the lobby, so life is Alive and no team is shown. */
export function PlayerCard({ name, seatNumber, host, you, avatarId = null, connectionStatus, actions }: PlayerCardProps) {
  const here = connectionStatus === 'CONNECTED';
  const presence = here ? 'Here' : 'Away';
  const detail = [`Seat ${seatNumber}`, 'Alive', host ? 'Host' : null, you ? 'You' : null, presence].filter(Boolean).join(' · ');
  return (
    <article className="ww-player" aria-label={`${name}, ${detail}`}>
      <PlayerAvatar name={name} avatarId={avatarId} />
      <div className="ww-player-copy">
        <p className="ww-player-name">{name}</p>
        <p className="ww-player-meta">{[`Seat ${seatNumber}`, host ? 'Host' : null, you ? 'You' : null].filter(Boolean).join(' · ')}</p>
      </div>
      <span className="ww-pill" data-tone={here ? 'ready' : 'waiting'}>
        {presence}
      </span>
      {actions ? <div className="ww-player-actions">{actions}</div> : null}
    </article>
  );
}
