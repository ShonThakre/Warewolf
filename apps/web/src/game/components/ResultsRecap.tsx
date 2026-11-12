import type { CancelledResults, FinishedResults } from '@warewolf/contracts';
import { lifeLabel } from './phaseCopy';
import { PlayerAvatar } from './PlayerAvatar';
import { deathLine, individualWinnerNames, infectionLine, seatRoles, teamClass, teamWord, usesLine } from './resultsCopy';
import { VoteTally } from './VoteTally';
import { recapOrder } from '../state/results';

/**
 * The results rail (WW-903). A finished game lists roles. A cancelled game
 * lists seats and nothing else. Chat is not mounted here.
 */
export function ResultsRecap({ finished, cancelled }: { readonly finished: FinishedResults | null; readonly cancelled: CancelledResults | null }) {
  if (cancelled) {
    return (
      <div className="ww-recap">
        <h2 className="ww-recap-title">Seats</h2>
        <p className="ww-recap-detail">Roles stay hidden for a cancelled game.</p>
        <ul className="ww-recap-list" aria-label="Seats">
          {cancelled.seats.map((seat) => (
            <li key={seat.playerId} className="ww-recap-seat">
              <PlayerAvatar name={seat.displayName} size="nav" avatarId={seat.avatarId} />
              <div className="ww-recap-main">
                <p className="ww-chat-name">
                  {seat.displayName}
                  {seat.isHost ? <span className="ww-seat-tag"> Host</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!finished) return null;
  const seats = recapOrder(finished.seats);
  const alone = individualWinnerNames(finished);
  return (
    <div className="ww-recap">
      <h2 className="ww-recap-title">Recap</h2>
      {alone.length > 0 ? (
        <section className="ww-recap-winners" aria-label="Individual wins">
          <h3 className="ww-recap-subtitle">Won alone</h3>
          <ul className="ww-recap-notes">
            {alone.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {finished.infections.length > 0 ? (
        <ul className="ww-recap-notes" aria-label="Infections">
          {finished.infections.map((infection) => (
            <li key={`${infection.roundNumber}:${infection.targetPlayerId}`}>{infectionLine(finished, infection)}</li>
          ))}
        </ul>
      ) : null}
      {finished.tallies.length > 0 ? (
        <div className="ww-recap-tallies">
          {finished.tallies.map((tally) => (
            <VoteTally
              key={`${tally.roundNumber}-${tally.ballot}`}
              tally={tally}
              nameOf={(playerId) => finished.seats.find((seat) => seat.playerId === playerId)?.displayName ?? 'A player'}
            />
          ))}
        </div>
      ) : null}
      <ul className="ww-recap-list" aria-label="Players">
        {seats.map((seat) => {
          const died = deathLine(seat);
          const uses = usesLine(seat.abilityUses);
          return (
            <li key={seat.playerId} className="ww-recap-seat">
              <PlayerAvatar name={seat.displayName} size="nav" avatarId={seat.avatarId} dead={seat.lifeStatus === 'DEAD'} />
              <div className="ww-recap-main">
                <p className="ww-chat-name">
                  {seat.displayName}
                  {seat.isHost ? <span className="ww-seat-tag"> Host</span> : null}
                  {seat.individualWin ? <span className="ww-seat-tag"> Won alone</span> : null}
                </p>
                <p className="ww-recap-roles">{seatRoles(seat)}</p>
                <p className={teamClass(seat.finalFaction)}>{teamWord(seat.finalFaction)}</p>
                <p className="ww-seat-life" data-life={seat.lifeStatus}>
                  {lifeLabel(seat.lifeStatus)}
                </p>
                {died ? <p className="ww-recap-detail">{died}</p> : null}
                {uses ? <p className="ww-recap-detail">{uses}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
