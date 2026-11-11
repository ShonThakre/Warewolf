import type { LobbyProjection } from '@warewolf/contracts';
import type { Faction, GameMode } from '@warewolf/domain';

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
    case 'SEATS_OPEN':
      return `Waiting for players. ${seated} of ${seats} seats are filled.`;
    case 'SEATS_OVER':
      return 'This room has more players than the setup allows.';
    case 'CONFIG_INVALID':
      return 'The role setup has problems to fix before the game can start.';
    case 'NOT_LOBBY':
      return 'This room is no longer accepting a start.';
  }
}

/** Why Start stays closed. A ready room has no sentence: the Start button is the action. */
export function startSentences(input: {
  status: string;
  ready: boolean;
  blockers: readonly StartBlocker[];
  requiresWarningAcknowledgement: boolean;
  seated: number;
  seats: number;
}): string[] {
  if (input.status === 'CANCELLED') return ['This room was cancelled.'];
  const lines = input.blockers.map((blocker) => blockerSentence(blocker, input.seated, input.seats));
  if (input.ready && input.requiresWarningAcknowledgement) {
    lines.push('Warnings still need acknowledgement.');
  }
  return lines;
}
