import type { HostDashboard } from '@warewolf/contracts';
import type { Faction } from '@warewolf/domain';
import { roleLabel } from '../components/resultsCopy';
import { dashboardSeat } from '../state/hostDashboard';

/** Team colour always comes with its word. */
const FACTION_WORD: Record<Faction, string> = {
  VILLAGE: 'Village',
  WOLF_PACK: 'Wolf',
  NEUTRAL: 'Neutral',
  INDEPENDENT: 'Independent',
};

const FAILURE_WORD: Record<string, string> = {
  ALPHA_DEAD: 'The Alpha was already dead',
  CAP_SUCCESS: 'The infection limit was already reached',
  CAP_SIZE: 'The pack was already full',
  TARGET_DEAD: 'The target was already dead',
  TARGET_INELIGIBLE: 'The target could not be infected',
  BLOCKED: 'The infection was blocked',
  SEALED: 'Infection is sealed',
  DISABLED: 'Infection is off',
};

const CAUSE_WORD: Record<string, string> = {
  WOLF_KILL: 'Wolf kill',
  SNIPER: 'Sniper',
  POISON: 'Poison',
  REVENGE: 'Revenge',
  DAY_VOTE: 'Day vote',
};

const STATUS_WORD: Record<string, string> = {
  PENDING: 'Submitted',
  LOCKED: 'Submitted',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const VICTORY_WORD: Record<string, string> = {
  ACHIEVED: 'Achieved',
  FAILED: 'Failed',
  REVOKED: 'Revoked',
  NONE: 'Undecided',
};

export const HOST_SECTIONS = ['overview', 'players', 'infections', 'actions', 'doctor', 'votes', 'eliminations', 'victory', 'events', 'setup'] as const;
export type HostSection = (typeof HOST_SECTIONS)[number];

export const SECTION_LABEL: Record<HostSection, string> = {
  overview: 'Overview',
  players: 'Players and roles',
  infections: 'Infection history',
  actions: 'Night actions',
  doctor: 'Doctor',
  votes: 'Votes',
  eliminations: 'Eliminations',
  victory: 'Victory flags',
  events: 'Event log',
  setup: 'Configuration',
};

export function factionWord(faction: Faction): string {
  return FACTION_WORD[faction];
}

export function seatName(dashboard: HostDashboard, playerId: string | null): string {
  if (playerId === null) return 'Abstain';
  return dashboardSeat(dashboard, playerId)?.displayName ?? 'A player';
}

/** A word for an ability. The id never reaches the screen. */
export function abilityWord(abilityId: string): string {
  if (abilityId === 'doctor_save') return 'Doctor';
  if (abilityId.includes('infect')) return 'Infection';
  if (abilityId.endsWith('_kill') || abilityId.includes('kill')) return 'Wolf kill';
  if (abilityId.includes('protect') || abilityId.includes('save')) return 'Protect';
  if (abilityId.includes('poison')) return 'Poison';
  if (abilityId.includes('investigate') || abilityId.includes('see')) return 'Investigate';
  return 'A night action';
}

export function failureWord(reason: string | null): string {
  if (!reason) return 'It failed';
  return FAILURE_WORD[reason] ?? 'It failed';
}

export function causeWord(type: string): string {
  return CAUSE_WORD[type] ?? 'A cause';
}

export function submissionWord(status: string): string {
  return STATUS_WORD[status] ?? 'Recorded';
}

export function victoryWord(state: string): string {
  return VICTORY_WORD[state] ?? 'Recorded';
}

export function roleWord(roleId: string): string {
  return roleLabel(roleId);
}
