import type { MyRole, OwnAbility, RoleRef } from '@warewolf/contracts';
import { DEFAULT_CATALOG, type Faction } from '@warewolf/domain';
import { nightAbilitiesForRound } from '../state/role';

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
  return `${parts.join('. ')}.`;
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
