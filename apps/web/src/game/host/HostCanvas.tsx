import type { GameEvent, HostDashboard } from '@warewolf/contracts';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PHASE_LABEL, lifeLabel } from '../components/phaseCopy';
import { eventSentence } from '../state/hostEvents';
import { dashboardSeat, openBallot } from '../state/hostDashboard';
import { abilityWord, causeWord, factionWord, failureWord, roleWord, seatName, submissionWord, victoryWord, type HostSection } from './dashboardCopy';

/** One secret section. Nothing here is rendered on a player route. */
export function HostCanvas({
  section,
  dashboard,
  events,
  eventsError,
}: {
  section: HostSection;
  dashboard: HostDashboard;
  events: readonly GameEvent[];
  eventsError: string | null;
}) {
  if (section === 'overview') return <Overview dashboard={dashboard} />;
  if (section === 'players') return <Players dashboard={dashboard} />;
  if (section === 'infections') return <Infections dashboard={dashboard} />;
  if (section === 'actions') return <Actions dashboard={dashboard} />;
  if (section === 'doctor') return <Doctor dashboard={dashboard} />;
  if (section === 'votes') return <Votes dashboard={dashboard} />;
  if (section === 'eliminations') return <Eliminations dashboard={dashboard} />;
  if (section === 'victory') return <Victory dashboard={dashboard} />;
  if (section === 'events') return <Events events={events} error={eventsError} />;
  return (
    <p className="ww-host-copy">The setup is locked for this game. It can be changed in the lobby before the next game.</p>
  );
}

function Overview({ dashboard }: { dashboard: HostDashboard }) {
  const { overview } = dashboard;
  return (
    <ul className="ww-host-facts" aria-label="Overview">
      <li>Round {overview.roundNumber}</li>
      <li>{PHASE_LABEL[overview.phase]}</li>
      <li>{overview.alive} alive</li>
      <li>
        {overview.wolfAlignedAlive} Wolf
      </li>
      <li>
        Infections {overview.infection.successes} of {overview.infection.max}
        {overview.infection.sealed ? '. Sealed' : ''}
        {overview.infection.enabled ? '' : '. Off'}
      </li>
    </ul>
  );
}

function Players({ dashboard }: { dashboard: HostDashboard }) {
  return (
    <ul className="ww-host-list">
      {dashboard.roster.players.map((player) => {
        const changed = player.originalRoleId !== player.currentRoleId;
        return (
          <li key={player.playerId}>
            <strong>{player.displayName}</strong>
            <span>
              {roleWord(player.originalRoleId)}
              {changed ? `, now ${roleWord(player.currentRoleId)}` : ''}. {factionWord(player.currentFaction)}. {lifeLabel(player.lifeStatus)}.
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Infections({ dashboard }: { dashboard: HostDashboard }) {
  if (dashboard.infections.length === 0) return <p className="ww-host-copy">No infection attempts yet.</p>;
  return (
    <ul className="ww-host-list">
      {dashboard.infections.map((row) => (
        <li key={`${row.roundNumber}-${row.targetPlayerId}-${row.outcome}`}>
          <strong>
            {seatName(dashboard, row.sourcePlayerId)} on {seatName(dashboard, row.targetPlayerId)}
          </strong>
          <span>
            Night {row.roundNumber}. {row.outcome === 'SUCCESS' ? 'Success' : failureWord(row.failureReason)}.
          </span>
        </li>
      ))}
    </ul>
  );
}

function Actions({ dashboard }: { dashboard: HostDashboard }) {
  if (dashboard.submissions.length === 0) {
    return (
      <section className="ww-host-panel" aria-label="Submitted night actions">
        <h3 className="ww-host-panel-title">Submitted night actions (host-only)</h3>
        <p className="ww-host-copy">No submissions this round.</p>
      </section>
    );
  }
  return (
    <section className="ww-host-panel" aria-label="Submitted night actions">
      <h3 className="ww-host-panel-title">Submitted night actions (host-only)</h3>
      <div className="ww-host-table-wrap">
        <table className="ww-host-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Ability</th>
              <th scope="col">Target(s)</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.submissions.map((row) => {
              const seat = dashboardSeat(dashboard, row.playerId);
              const name = seat?.displayName ?? 'A player';
              const targets = row.targetPlayerIds.length === 0 ? '—' : row.targetPlayerIds.map((id) => seatName(dashboard, id)).join(', ');
              return (
                <tr key={row.actionId}>
                  <td>
                    <span className="ww-host-player">
                      <PlayerAvatar name={name} avatarId={seat?.avatarId ?? null} />
                      {name}
                    </span>
                  </td>
                  <td>{abilityWord(row.abilityId)}</td>
                  <td>{targets}</td>
                  <td>
                    <span className="ww-host-status">{submissionWord(row.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Doctor({ dashboard }: { dashboard: HostDashboard }) {
  const rows = dashboard.submissions.filter((row) => row.abilityId === 'doctor_save');
  if (rows.length === 0) return <p className="ww-host-copy">The Doctor has not answered this round.</p>;
  return (
    <ul className="ww-host-list">
      {rows.map((row) => (
        <li key={row.actionId}>
          <strong>{seatName(dashboard, row.playerId)}</strong>
          <span>
            {row.targetPlayerIds.length === 0 ? 'No one yet' : row.targetPlayerIds.map((id) => seatName(dashboard, id)).join(', ')}. {submissionWord(row.status)}.
          </span>
        </li>
      ))}
    </ul>
  );
}

function Votes({ dashboard }: { dashboard: HostDashboard }) {
  if (dashboard.ballots.length === 0) return <p className="ww-host-copy">No votes yet.</p>;
  const current = openBallot(dashboard);
  return (
    <div className="ww-host-stack">
      {dashboard.ballots.map((ballot) => (
        <section key={`${ballot.roundNumber}-${ballot.ballot}`} aria-label={ballot.open ? 'Open vote' : `Closed vote, round ${ballot.roundNumber}`}>
          <h3 className="ww-host-subhead">
            Round {ballot.roundNumber}
            {ballot.ballot === 2 ? ', revote' : ''}
            {ballot.open ? '. Open' : '. Closed'}
          </h3>
          <ul className="ww-host-list">
            {ballot.counts.map((count) => (
              <li key={count.targetPlayerId ?? 'abstain'}>
                <strong>{seatName(dashboard, count.targetPlayerId)}</strong>
                <span>{count.total}</span>
              </li>
            ))}
          </ul>
          {ballot === current ? (
            <ul className="ww-host-list" aria-label="Voters">
              {ballot.votes.map((vote) => (
                <li key={vote.voterPlayerId}>
                  {seatName(dashboard, vote.voterPlayerId)} voted {seatName(dashboard, vote.targetPlayerId)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Eliminations({ dashboard }: { dashboard: HostDashboard }) {
  if (dashboard.eliminations.length === 0) return <p className="ww-host-copy">No eliminations yet.</p>;
  return (
    <ul className="ww-host-list">
      {dashboard.eliminations.map((row) => (
        <li key={`${row.roundNumber}-${row.playerId}`}>
          <strong>{seatName(dashboard, row.playerId)}</strong>
          <span>
            Round {row.roundNumber}, {row.phaseKind === 'NIGHT' ? 'night' : 'day'}. {roleWord(row.roleAtDeath)}. {factionWord(row.factionAtDeath)}.
            {row.causes.map((cause) => ` ${causeWord(cause.type)} by ${cause.actorIds.map((id) => seatName(dashboard, id)).join(', ')}.`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Victory({ dashboard }: { dashboard: HostDashboard }) {
  const outcome = dashboard.victory.outcome;
  return (
    <div className="ww-host-stack">
      <p className="ww-host-copy">
        {outcome === null ? 'The game is still running.' : outcome.draw ? 'Draw.' : outcome.team ? `${factionWord(outcome.team)} wins.` : 'Individual wins.'}
      </p>
      {dashboard.victory.individuals.length === 0 ? null : (
        <ul className="ww-host-list">
          {dashboard.victory.individuals.map((row) => (
            <li key={row.playerId}>
              <strong>{seatName(dashboard, row.playerId)}</strong>
              <span>
                {roleWord(row.roleId)}. {victoryWord(row.state)}.
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Events({ events, error }: { events: readonly GameEvent[]; error: string | null }) {
  if (error) return <p className="ww-host-copy">{error}</p>;
  if (events.length === 0) return <p className="ww-host-copy">No events yet. Host records stay on this screen.</p>;
  return (
    <ul className="ww-host-list" aria-label="Event log">
      {events.map((event) => (
        <li key={event.seq}>{eventSentence(event)}</li>
      ))}
    </ul>
  );
}
