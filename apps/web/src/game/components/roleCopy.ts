import type { MyRole, OwnAbility, RoleRef } from '@warewolf/contracts';
import { DEFAULT_CATALOG, type AbilityDefinition, type Faction, type IndividualTrigger, type RoleDefinition, type VictoryDefinition } from '@warewolf/domain';
import { nightAbilitiesForRound } from '../state/role';

/** Team key for portrait frames and chips. Color always sits beside the team word. */
export const TEAM_KEY: Record<Faction, 'wolf' | 'village' | 'neutral' | 'independent'> = {
  WOLF_PACK: 'wolf',
  VILLAGE: 'village',
  NEUTRAL: 'neutral',
  INDEPENDENT: 'independent',
};

export interface RoleAvailability {
  /** Can be added to a setup and dealt at the start. */
  readonly seatable: boolean;
  /** Short badge. Null for an ordinary seatable role. */
  readonly badge: string | null;
  /** Plain sentence under the badge. */
  readonly explanation: string | null;
}

/** Why a catalog role is or is not in play. Decision ids are a reference, never the only explanation. */
export function roleAvailability(role: Pick<RoleDefinition, 'implementationStatus' | 'seatable' | 'decisionIds'>): RoleAvailability {
  if (role.implementationStatus === 'UNRESOLVED') {
    const reference = role.decisionIds.length > 0 ? ` Decision ${role.decisionIds.join(', ')}.` : '';
    return {
      seatable: false,
      badge: 'Not in version 1',
      explanation: `This role has no defined power in the app yet, so it cannot be seated.${reference}`,
    };
  }
  if (!role.seatable) {
    return {
      seatable: false,
      badge: 'Gained in play',
      explanation: 'Never dealt at the start. A player becomes this role during the game.',
    };
  }
  return { seatable: true, badge: null, explanation: null };
}

/** Limits for a catalog ability, as one short sentence. Empty when the ability has none. */
export function catalogLimitLine(ability: AbilityDefinition): string {
  const parts: string[] = [];
  if (ability.onlyRound != null) parts.push(`Only in round ${ability.onlyRound}.`);
  else if (ability.availableFromRound > 1) parts.push(`From round ${ability.availableFromRound}.`);
  if (ability.usesPerPhase === 1) parts.push(ability.timing === 'DAY' ? 'Once each day.' : 'Once each night.');
  else if (ability.usesPerPhase != null) parts.push(`${ability.usesPerPhase} times each phase.`);
  if (ability.usesPerGame === 1) parts.push('Once per game.');
  else if (ability.usesPerGame != null) parts.push(`${ability.usesPerGame} times per game.`);
  if (ability.cooldownNights > 0) parts.push(`Rests ${ability.cooldownNights} ${ability.cooldownNights === 1 ? 'night' : 'nights'} after a use.`);
  return parts.join(' ');
}

export function abilityTimingWord(timing: AbilityDefinition['timing']): string {
  switch (timing) {
    case 'NIGHT':
      return 'Night';
    case 'NIGHT_REACTION':
      return 'Night reaction';
    case 'DAY':
      return 'Day';
    case 'PASSIVE':
      return 'Always on';
  }
}

const TRIGGER_LINE: Record<IndividualTrigger, string> = {
  ELIMINATED_BY_DAY_VOTE: 'Wins when the day vote eliminates them.',
  MARKED_TARGET_ELIMINATED: 'Wins when their marked player is eliminated.',
  SOLE_SURVIVOR: 'Wins as the last player standing.',
  ALIVE_AT_GAME_END: 'Wins by being alive when the game ends.',
  ALIVE_WITH_SERVANT: 'Wins when alive with a living Servant at the end, or when the Vampire team outlasts the Village and the Wolves.',
  WITH_VAMPIRE: 'Shares the Vampire team’s win while alive.',
  ALL_WOLVES_ELIMINATED_WHILE_ALIVE: 'Wins by being alive when no wolf is left.',
  ALIVE_AFTER_REVIVE: 'Wins after returning at least one player and being alive at the end.',
  CHAOS_THREE_AND_FINAL_FIVE: 'Wins after three Chaos events change the game, while alive with five or fewer players left.',
};

/** How a catalog profile wins, in one or two sentences. */
export function victoryLine(victory: VictoryDefinition, teamName: string): string {
  if (victory.type === 'NONE') return 'No win condition is defined for this role.';
  if (victory.type === 'TEAM') return `Wins with the ${teamName} team.`;
  const line = TRIGGER_LINE[victory.trigger];
  return victory.endGameOnWin ? line : `${line} The game goes on after this win.`;
}

const TEAM: Record<Faction, { word: string; className: string }> = {
  VILLAGE: { word: 'Village', className: 'ww-team ww-team-village' },
  WOLF_PACK: { word: 'Wolf', className: 'ww-team ww-team-wolf' },
  NEUTRAL: { word: 'Neutral', className: 'ww-team ww-team-neutral' },
  INDEPENDENT: { word: 'Independent', className: 'ww-team ww-team-independent' },
};

const CAPABILITY_NAME: Record<string, string> = {
  INVESTIGATE: 'Investigate',
  PROTECT: 'Protect',
  HEAL: 'Heal',
  KILL: 'Kill',
  POISON: 'Poison',
  INFECT: 'Infect',
  BLOCK_ACTION: 'Block',
  TRACK: 'Track',
  DETECT: 'Detect',
  ROLE_COPY: 'Copy a role',
  ROLE_REVEAL: 'Reveal a result',
  VOTE_MODIFIER: 'Change a vote',
  SURVIVE_DEATH: 'Survive a death',
  REVENGE: 'Revenge',
  COMMUNICATE_WITH_DEAD: 'Speak with the dead',
  MODIFY_VOTING: 'Change the vote',
  TEAM_SUPPORT: 'Support your team',
  CONVERT: 'Mark a player',
  REWIND: 'Rewind a player',
  SILENCE: 'Silence a player',
  REVIVE: 'Return a player',
  HINT: 'Send a hint',
  CHAOS: 'Trigger chaos',
};

/** A capability word for a catalog card. An unknown capability stays the word "Ability", never a raw id. */
export function capabilityTitle(capability: string | null): string {
  if (!capability) return 'Passive';
  return CAPABILITY_NAME[capability] ?? 'Ability';
}

/** The profile sentence, or the role's own sentence when the profile has none. */
export function roleDescription(role: RoleRef): string {
  const definition = DEFAULT_CATALOG.byId.get(role.id);
  if (!definition) return '';
  return definition.profiles[role.profileId]?.description ?? definition.description;
}

function timingLine(ability: OwnAbility): string {
  switch (ability.timing) {
    case 'NIGHT':
      return 'Each night';
    case 'NIGHT_REACTION':
      return 'During the night reaction';
    case 'DAY':
      return 'During the day';
    case 'PASSIVE':
      return 'Always on';
  }
}

function usesLine(ability: OwnAbility): string | null {
  if (ability.status === 'EXHAUSTED' || ability.usesRemaining === 0) return 'Used up';
  if (ability.status === 'REVOKED') return 'Taken away';
  if (ability.usesRemaining === null) return 'Unlimited uses';
  return `${ability.usesRemaining} ${ability.usesRemaining === 1 ? 'use' : 'uses'} left`;
}

/** Limits for one ability, written as a sentence. The role id is not included. */
export function abilityDetail(ability: OwnAbility): string {
  const parts = [timingLine(ability), usesLine(ability)].filter((part): part is string => Boolean(part));
  if (ability.usesPerPhase === 1) parts.push(ability.timing === 'DAY' ? 'once each day' : 'once each night');
  else if (ability.usesPerPhase != null && ability.usesPerPhase > 1) parts.push(`${ability.usesPerPhase} times each phase`);
  if (ability.cooldownNights > 0) {
    parts.push(`then rests ${ability.cooldownNights} ${ability.cooldownNights === 1 ? 'night' : 'nights'}`);
  }
  if (ability.availableFromRound > 1) parts.push(`from night ${ability.availableFromRound}`);
  if (ability.onlyRound != null) parts.push(`only on night ${ability.onlyRound}`);
  if (ability.expiresRound != null) parts.push(`through night ${ability.expiresRound}`);
  if (ability.target.kind === 'PLAYERS') {
    parts.push(ability.target.count === 1 ? 'chooses one player' : `chooses ${ability.target.count} players`);
  }
  if (ability.target.kind === 'FINAL_WOLF_TARGET') parts.push('answers the announced wolf target');
  return `${parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('. ')}.`;
}

export function abilityTitle(ability: OwnAbility): string {
  if (ability.capability) return CAPABILITY_NAME[ability.capability] ?? 'Ability';
  return 'Ability';
}

export interface RoleCardContent {
  readonly name: string;
  readonly team: string;
  readonly teamClass: string;
  readonly description: string;
  /** Set when infection or another conversion changed the role. */
  readonly originalLine: string | null;
  readonly abilities: readonly { title: string; detail: string }[];
  readonly tonight: string;
  /** Null when this game does not show teammates. */
  readonly teammates: string | null;
}

/** Plain words for the card. Role ids stay out of the result. */
export function roleCardContent(role: MyRole): RoleCardContent {
  const team = TEAM[role.currentRole.faction];
  const tonightAbilities = nightAbilitiesForRound(role, 1);
  const tonight =
    tonightAbilities.length === 0 ? 'You have no night action.' : `Tonight: ${tonightAbilities.map(abilityTitle).join(', ')}.`;
  let teammates: string | null = null;
  if (role.teammatesVisible) {
    teammates =
      role.teammates.length === 0
        ? 'You are the only one.'
        : `You know ${role.teammates.map((mate) => `${mate.displayName}, seat ${mate.seatNumber}`).join('; ')}.`;
  }
  return {
    name: role.currentRole.name,
    team: team.word,
    teamClass: team.className,
    description: roleDescription(role.currentRole),
    originalLine: role.originalRole.id === role.currentRole.id ? null : `You started as ${role.originalRole.name}.`,
    abilities: role.abilities.map((ability) => ({ title: abilityTitle(ability), detail: abilityDetail(ability) })),
    tonight,
    teammates,
  };
}
