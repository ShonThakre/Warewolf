import type { LobbyProjection } from '@warewolf/contracts';
import { BLOCKING_DECISIONS, type Faction, type GameMode } from '@warewolf/domain';

type StartBlocker = LobbyProjection['start']['blockers'][number];

export const MODE_LABEL: Record<GameMode, string> = {
  INFECTION: 'Infection Edition',
  CLASSIC: 'Classic',
  EXPANDED: 'Expanded',
  CUSTOM: 'Custom',
  ULTIMATE_20: 'Ultimate 20',
};

/** Independent seats in Ultimate 20 are the Chaos team. Other modes keep the catalog word. */
export function teamWord(mode: GameMode, faction: Faction): string {
  if (mode === 'ULTIMATE_20' && faction === 'INDEPENDENT') return 'Chaos';
  return FACTION_LABEL[faction];
}

/** Team color is always paired with the word. The classes live in the theme. */
export const FACTION_LABEL: Record<Faction, string> = {
  VILLAGE: 'Village',
  WOLF_PACK: 'Wolf',
  NEUTRAL: 'Neutral',
  INDEPENDENT: 'Independent',
};

export const FACTION_CLASS: Record<Faction, string> = {
  VILLAGE: 'ww-team ww-team-village',
  WOLF_PACK: 'ww-team ww-team-wolf',
  NEUTRAL: 'ww-team ww-team-neutral',
  INDEPENDENT: 'ww-team ww-team-independent',
};

export function blockerSentence(blocker: StartBlocker, seated: number, seats: number): string {
  switch (blocker) {
    case 'SEATS_OPEN': {
      const open = Math.max(0, seats - seated);
      const seatsWord = open === 1 ? 'seat is' : 'seats are';
      return `Room not ready: ${open} more ${seatsWord} needed to start (${seated} / ${seats}).`;
    }
    case 'SEATS_OVER':
      return 'This room has more players than the setup allows.';
    case 'CONFIG_INVALID':
      return 'The host needs to fix the role setup before the game can start.';
    case 'NOT_LOBBY':
      return 'This room is no longer accepting a start.';
  }
}

/** A host-facing sentence. Codes stay off the screen. */
export function explainIssue(issue: { code: string; message: string; decisionIds?: readonly string[] | undefined }): string {
  switch (issue.code) {
    case 'WOLF_CAP':
      return explainWolfCap(issue.message);
    case 'ROLE_COUNT_MISMATCH':
      return explainRoleCount(issue.message);
    case 'DECISION_UNSET':
    case 'DECISION_MISMATCH':
      return explainDecision(issue.decisionIds?.[0]) ?? issue.message;
    case 'INFECTION_WITHOUT_ALPHA':
      return 'Infection is on, but no Alpha Wolf is seated. Add one on the Settings or Roles step, or turn Infection off.';
    default:
      return issue.message;
  }
}

/** A blocking rule decision in the host's words, pointing at the control that settles it. */
function explainDecision(id: string | undefined): string | null {
  if (id === 'OD-03') return 'Choose what happens when an infected player is also killed that night. It is under Infection on the Settings step.';
  const decision = BLOCKING_DECISIONS.find((item) => item.id === id);
  return decision ? `Choose a rule for "${decision.title.toLowerCase()}" on the Settings step.` : null;
}

function explainWolfCap(message: string): string {
  const match = message.match(/wolf cap \(([^)]+)\).*starting pack \(([^)]+)\)/i);
  if (!match) {
    return 'Raise the wolf cap to at least the number of wolves dealt at the start. The cap is the most wolves allowed, including players who turn into wolves during the game. Change it on the Settings step.';
  }
  const cap = match[1];
  const pack = Number(match[2]);
  const dealt = pack === 1 ? '1 wolf is dealt at the start' : `${pack} wolves are dealt at the start`;
  return `Raise the wolf cap from ${cap} to at least ${pack}. ${dealt}. The cap is the most wolves allowed, including players who turn into wolves during the game. Change it on the Settings step.`;
}

function explainRoleCount(message: string): string {
  const match = message.match(/Roles fill (\d+) seats but the game has (\d+) players/);
  if (!match) return message;
  const filled = Number(match[1]);
  const players = Number(match[2]);
  if (filled < players) {
    const missing = players - filled;
    return `The roles fill ${filled} of ${players} seats. Add ${missing} more role ${missing === 1 ? 'seat' : 'seats'}.`;
  }
  const extra = filled - players;
  return `The roles fill ${filled} seats, but this game has ${players} players. Remove ${extra} role ${extra === 1 ? 'seat' : 'seats'}.`;
}

/** Why Start stays closed. A ready room has no sentence: the Start button is the action. */
export function startSentences(input: {
  status: string;
  ready: boolean;
  blockers: readonly StartBlocker[];
  requiresWarningAcknowledgement: boolean;
  seated: number;
  seats: number;
  /** Plain sentences that replace the generic setup blocker. */
  problems?: readonly string[];
  /** Plain warning sentences, shown when start only needs an acknowledgement. */
  warnings?: readonly string[];
}): string[] {
  if (input.status === 'CANCELLED') return ['This room was cancelled.'];
  const lines = input.blockers.flatMap((blocker) => {
    if (blocker === 'CONFIG_INVALID' && input.problems && input.problems.length > 0) return [...input.problems];
    return [blockerSentence(blocker, input.seated, input.seats)];
  });
  if (input.ready && input.requiresWarningAcknowledgement) {
    if (input.warnings && input.warnings.length > 0) lines.push(...input.warnings, 'Acknowledge these to start.');
    else lines.push('Warnings still need acknowledgement.');
  }
  return lines;
}

/**
 * Warnings the acknowledge dialog shows. Server text wins when the saved
 * draft is what start will acknowledge. An empty required list still says so.
 */
export function acknowledgementCopy(input: {
  local: readonly string[];
  /** Null while the saved configuration has not loaded. */
  server: readonly string[] | null;
  loading: boolean;
  required: boolean;
}): { lines: readonly string[]; loading: boolean } {
  const lines = input.server && input.server.length > 0 ? input.server : input.local;
  if (lines.length > 0) return { lines, loading: false };
  if (!input.required) return { lines: [], loading: false };
  if (input.loading || input.server === null) return { lines: [], loading: true };
  return { lines: ['This setup has warnings that need acknowledgement.'], loading: false };
}

/** Home return control. Unknown status is the loading fallback. */
export function returnSeatLabel(status: string | null): string {
  if (status === 'LOBBY') return 'Return to the lobby';
  if (status === 'ACTIVE') return 'Return to the game';
  if (status === 'FINISHED' || status === 'CANCELLED') return 'See the results';
  return 'Return to your game';
}
