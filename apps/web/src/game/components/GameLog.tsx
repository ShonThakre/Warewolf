import type { LogEntry, LogPlayer, LogRound } from '@warewolf/contracts';
import { Button, Chip } from '@mui/material';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameLogView } from '../state/gameLog';
import { GameIcon } from './GameIcon';
import { LOG_FILTERS, lineText, logLine, matchesFilter, roundSummary, VISIBILITY_LABEL, type LogFilter, type LogSegment } from './logCopy';
import { PlayerAvatar } from './PlayerAvatar';
import { teamClass, teamWord } from './resultsCopy';
import './game-log.css';

/**
 * LOG-02: the round-by-round game log. One component for the lobby rail, the
 * table rail, the results recap, and the host dashboard, in every layout.
 *
 * - Newest round first, with night before day inside a round, so the latest
 *   fact is where the eye lands on a phone.
 * - Older rounds collapse to their summary; the player opens what they need.
 * - Private entries carry "Only you", unlocked secrets carry "Revealed".
 *   The server decides what each seat receives; this only draws it.
 */
export interface GameLogProps {
  readonly view: GameLogView;
  readonly youId: string;
  /** `live`: rail during play. `recap`: results, every round open. `host`: the host dashboard. */
  readonly variant?: 'live' | 'recap' | 'host';
  /** True while the log is on screen. Clears the unread count. */
  readonly active?: boolean;
}

export function GameLog({ view, youId, variant = 'live', active = true }: GameLogProps) {
  const { log, isLoading, error, refetch, markSeen } = view;
  const [filter, setFilter] = useState<LogFilter>('all');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [fresh, setFresh] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(log?.lastSeq ?? 0);
  const filterId = useId();

  useEffect(() => {
    if (active) markSeen();
  }, [active, markSeen, log?.lastSeq]);

  // A new fact while the player has scrolled into older rounds: offer a jump instead of moving the page.
  useEffect(() => {
    const next = log?.lastSeq ?? 0;
    if (next > lastSeq.current && (scroller.current?.scrollTop ?? 0) > 48) setFresh(true);
    lastSeq.current = next;
  }, [log?.lastSeq]);

  const seats = useMemo(() => {
    const map = new Map<string, LogPlayer>();
    if (!log) return map;
    for (const entry of [...log.lobby, ...log.rounds.flatMap((r) => [...r.night, ...r.day]), ...log.end]) {
      for (const p of [...entry.actors, ...entry.targets]) map.set(p.playerId, p);
    }
    return map;
  }, [log]);

  if (isLoading && !log) return <p className="ww-gamelog-empty">Opening the log…</p>;
  if (!log) {
    return (
      <div className="ww-gamelog-empty" role="alert">
        <p>{error?.message ?? 'The log could not be loaded.'}</p>
        <Button size="small" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  }

  const keep = (entries: readonly LogEntry[]) => entries.filter((e) => matchesFilter(e, filter, youId) && (filter === 'all' || e.kind !== 'PHASE_CHANGED'));
  const rounds = [...log.rounds].reverse();
  const end = keep(log.end);
  const lobby = keep(log.lobby);
  const anyRound = rounds.some((r) => keep(r.night).length + keep(r.day).length > 0);
  const nothing = end.length === 0 && lobby.length === 0 && !anyRound;
  const inLobby = log.status === 'LOBBY';

  // Defaults: the newest round open during play, everything open in a recap or when filtering.
  const isOpen = (key: string, byDefault: boolean) => (open.has(key) ? true : closed.has(key) ? false : byDefault);
  const toggle = (key: string, now: boolean) => {
    setOpen((s) => toggled(s, key, !now));
    setClosed((s) => toggled(s, key, now));
  };
  const expandAll = variant !== 'live' || filter !== 'all';

  return (
    <div className="ww-gamelog" data-variant={variant}>
      {log.revealed && variant !== 'host' ? (
        <p className="ww-gamelog-banner">
          <GameIcon name="eyeOff" size={18} />
          <span>The game is over. Every role, night action, and ballot is now revealed.</span>
        </p>
      ) : null}
      {variant === 'host' ? (
        <p className="ww-gamelog-banner" data-tone="host">
          <GameIcon name="lock" size={18} />
          <span>Host view: includes secrets the players cannot see until the game ends.</span>
        </p>
      ) : null}
      <div className="ww-gamelog-filters" role="group" aria-labelledby={filterId}>
        <span id={filterId} className="ww-sr">
          Show in the log
        </span>
        {LOG_FILTERS.filter((f) => !(inLobby && (f.id === 'deaths' || f.id === 'votes'))).map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            size="small"
            clickable
            color={filter === f.id ? 'primary' : 'default'}
            variant={filter === f.id ? 'filled' : 'outlined'}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>
      {fresh ? (
        <Button
          className="ww-gamelog-fresh"
          size="small"
          variant="contained"
          onClick={() => {
            scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
            setFresh(false);
          }}
        >
          New events ↑
        </Button>
      ) : null}
      <div
        className="ww-gamelog-scroll"
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Game log"
        tabIndex={0}
        onScroll={(event) => {
          if (event.currentTarget.scrollTop < 8) setFresh(false);
        }}
      >
        {nothing ? (
          <p className="ww-gamelog-empty">
            {filter !== 'all'
              ? 'Nothing here yet for this filter.'
              : inLobby
                ? 'Nothing yet. Joins and changes in the room appear here.'
                : 'Nothing yet. Events appear here as the game unfolds.'}
          </p>
        ) : null}

        {end.length > 0 ? (
          <section className="ww-gamelog-group" aria-label="End of the game">
            <ol className="ww-gamelog-list">
              {end.map((entry) => (
                <Entry key={entry.id} entry={entry} youId={youId} seats={seats} />
              ))}
            </ol>
          </section>
        ) : null}

        {rounds.map((round, index) => {
          const night = keep(round.night);
          const day = keep(round.day);
          if (night.length + day.length === 0) return null;
          const key = `r${round.roundNumber}`;
          const expanded = isOpen(key, expandAll || index === 0);
          return (
            <RoundGroup key={key} round={round} night={night} day={day} expanded={expanded} onToggle={() => toggle(key, expanded)} youId={youId} seats={seats} />
          );
        })}

        {lobby.length > 0 ? (
          inLobby ? (
            <ol className="ww-gamelog-list">
              {[...lobby].reverse().map((entry) => (
                <Entry key={entry.id} entry={entry} youId={youId} seats={seats} />
              ))}
            </ol>
          ) : (
            <Disclosure
              id="lobby"
              title="Before the game"
              summary={`${lobby.length} ${lobby.length === 1 ? 'event' : 'events'}`}
              expanded={isOpen('lobby', expandAll && filter !== 'all')}
              onToggle={() => toggle('lobby', isOpen('lobby', expandAll && filter !== 'all'))}
            >
              <ol className="ww-gamelog-list">
                {lobby.map((entry) => (
                  <Entry key={entry.id} entry={entry} youId={youId} seats={seats} />
                ))}
              </ol>
            </Disclosure>
          )
        ) : null}
      </div>
    </div>
  );
}

function toggled(set: ReadonlySet<string>, key: string, on: boolean): ReadonlySet<string> {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

function RoundGroup({
  round,
  night,
  day,
  expanded,
  onToggle,
  youId,
  seats,
}: {
  readonly round: LogRound;
  readonly night: readonly LogEntry[];
  readonly day: readonly LogEntry[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly youId: string;
  readonly seats: ReadonlyMap<string, LogPlayer>;
}) {
  return (
    <Disclosure id={`round-${round.roundNumber}`} title={`Round ${round.roundNumber}`} summary={roundSummary(round.summary)} expanded={expanded} onToggle={onToggle} tone={round.summary.deaths > 0 ? 'death' : undefined}>
      {night.length > 0 ? (
        <section className="ww-gamelog-stage" aria-label={`Night ${round.roundNumber}`}>
          <h4 className="ww-gamelog-stage-title">
            <GameIcon name="moon" size={16} />
            Night {round.roundNumber}
          </h4>
          <EntryList entries={night} youId={youId} seats={seats} />
        </section>
      ) : null}
      {day.length > 0 ? (
        <section className="ww-gamelog-stage" aria-label={`Day ${round.roundNumber}`}>
          <h4 className="ww-gamelog-stage-title">
            <GameIcon name="sun" size={16} />
            Day {round.roundNumber}
          </h4>
          <EntryList entries={day} youId={youId} seats={seats} />
        </section>
      ) : null}
    </Disclosure>
  );
}

/** A round or the lobby group: a header button that shows or hides its entries. */
function Disclosure({
  id,
  title,
  summary,
  expanded,
  onToggle,
  tone,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly tone?: 'death' | undefined;
  readonly children: ReactNode;
}) {
  const panel = useId();
  return (
    <section className="ww-gamelog-group" data-expanded={expanded} aria-labelledby={`${panel}-${id}`}>
      <h3 className="ww-gamelog-heading" id={`${panel}-${id}`}>
        <button type="button" className="ww-gamelog-toggle" aria-expanded={expanded} aria-controls={panel} onClick={onToggle}>
          <span className="ww-gamelog-title">{title}</span>
          <span className="ww-gamelog-summary" data-tone={tone}>
            {summary}
          </span>
          <GameIcon className="ww-gamelog-chevron" name="chevron" size={16} />
        </button>
      </h3>
      <div id={panel} hidden={!expanded}>
        {expanded ? children : null}
      </div>
    </section>
  );
}

/**
 * A stage's entries. A run of revealed ballots becomes one block, "who voted
 * for whom", instead of a row per voter: ten rows of the same sentence bury
 * the result.
 */
function EntryList({ entries, youId, seats }: { readonly entries: readonly LogEntry[]; readonly youId: string; readonly seats: ReadonlyMap<string, LogPlayer> }) {
  const items: (LogEntry | LogEntry[])[] = [];
  for (const entry of entries) {
    const last = items.at(-1);
    if (entry.kind === 'BALLOT' && Array.isArray(last) && last[0]?.detail.ballot === entry.detail.ballot) last.push(entry);
    else items.push(entry.kind === 'BALLOT' ? [entry] : entry);
  }
  return (
    <ol className="ww-gamelog-list">
      {items.map((item) => (Array.isArray(item) ? <BallotGroup key={item[0]!.id} ballots={item} youId={youId} /> : <Entry key={item.id} entry={item} youId={youId} seats={seats} />))}
    </ol>
  );
}

function BallotGroup({ ballots, youId }: { readonly ballots: readonly LogEntry[]; readonly youId: string }) {
  const revote = ballots[0]?.detail.ballot === 2;
  return (
    <li className="ww-logentry ww-ballots" data-tone="vote" data-visibility="REVEALED">
      <span className="ww-logentry-icon" aria-hidden="true">
        <GameIcon name="vote" size={18} />
      </span>
      <div className="ww-logentry-main">
        <p className="ww-logentry-text">{revote ? 'Who voted for whom in the revote' : 'Who voted for whom'}</p>
        <ul className="ww-ballot-list">
          {ballots.map((ballot) => {
            const [voter] = ballot.actors;
            const [target] = ballot.targets;
            return (
              <li key={ballot.id} className="ww-ballot">
                {voter ? <Segment segment={{ player: voter }} youId={youId} /> : 'Someone'}
                <span className="ww-ballot-arrow" aria-label="voted for">
                  →
                </span>
                {target ? <Segment segment={{ player: target }} youId={youId} /> : <span className="ww-ballot-abstain">abstained</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="ww-logentry-meta">
        <span className="ww-logentry-tag" data-visibility="REVEALED">
          <GameIcon name="eyeOff" size={12} />
          {VISIBILITY_LABEL.REVEALED}
        </span>
      </div>
    </li>
  );
}

function Entry({ entry, youId, seats }: { readonly entry: LogEntry; readonly youId: string; readonly seats: ReadonlyMap<string, LogPlayer> }) {
  const line = logLine(entry, youId, seats);
  const marker = entry.kind === 'PHASE_CHANGED';
  const time = new Date(entry.at);
  return (
    <li className="ww-logentry" data-tone={line.tone} data-visibility={entry.visibility} data-marker={marker || undefined} data-text={lineText(line)}>
      <span className="ww-logentry-icon" aria-hidden="true">
        <GameIcon name={line.icon} size={marker ? 14 : 18} />
      </span>
      <div className="ww-logentry-main">
        <p className="ww-logentry-text">
          {line.segments.map((segment, i) => (
            <Segment key={i} segment={segment} youId={youId} />
          ))}
        </p>
        {line.detail ? <p className="ww-logentry-detail">{line.detail}</p> : null}
      </div>
      <div className="ww-logentry-meta">
        {entry.visibility !== 'PUBLIC' ? (
          <span className="ww-logentry-tag" data-visibility={entry.visibility}>
            {entry.visibility === 'PRIVATE' ? <GameIcon name="lock" size={12} /> : <GameIcon name="eyeOff" size={12} />}
            {VISIBILITY_LABEL[entry.visibility]}
          </span>
        ) : null}
        {marker || Number.isNaN(time.getTime()) ? null : (
          <time dateTime={entry.at} aria-hidden="true">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        )}
      </div>
    </li>
  );
}

function Segment({ segment, youId }: { readonly segment: LogSegment; readonly youId: string }) {
  if (typeof segment === 'string') return <>{segment}</>;
  if ('team' in segment) return <span className={teamClass(segment.team)}>{teamWord(segment.team)}</span>;
  const { player } = segment;
  const you = player.playerId === youId;
  return (
    <span className="ww-logchip" data-you={you || undefined}>
      <PlayerAvatar name={player.displayName} avatarId={player.avatarId} size="nav" />
      <span className="ww-logchip-name">{you ? `${player.displayName} (you)` : player.displayName}</span>
    </span>
  );
}
