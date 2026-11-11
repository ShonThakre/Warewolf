import { NO_VICTORY, ability, players, profile, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section G of docs/werewolf/role-catalog.md. */

export const blacksmith: RoleDefinition = role({
  id: 'blacksmith',
  displayName: 'Blacksmith',
  description: 'Protects with forged gear. Two variants exist and are never merged.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-16'],
  profiles: [
    profile({
      id: 'blacksmith_item',
      status: 'RECOMMENDED',
      description: 'Gives one player a one-time shield that blocks a wolf kill. Spent when it blocks or when the holder dies.',
      decisionIds: ['OD-16'],
      abilities: [
        ability({
          id: 'blacksmith_shield',
          capability: 'PROTECT',
          cancels: ['WOLF_KILL'],
          usesPerGame: 1,
          target: players(),
          resultAudience: ['HOST'],
          // OD-16 item: the shield stays on its holder until it blocks a wolf kill or the holder dies.
          config: { holdUntilBlocked: true },
          decisionIds: ['OD-16'],
        }),
      ],
    }),
    profile({
      id: 'blacksmith_aura',
      status: 'UNRESOLVED',
      description: 'A reusable nightly protection close to Guard. Target and repeat rules are not defined yet.',
      decisionIds: ['OD-16'],
    }),
  ],
});

export const priest: RoleDefinition = role({
  id: 'priest',
  displayName: 'Priest',
  description: 'No defined power yet. Cannot be seated.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'UNRESOLVED',
  decisionIds: ['OD-17'],
  victory: NO_VICTORY,
});

export const elder: RoleDefinition = role({
  id: 'elder',
  displayName: 'Elder',
  description: 'Votes count double. If the wolves kill the Elder, the village is weakened in the next day vote.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-33'],
  abilities: [
    ability({
      id: 'elder_vote',
      capability: 'VOTE_MODIFIER',
      timing: 'PASSIVE',
      usesPerPhase: null,
      config: { weight: 2, wolfKillPenalty: 'PHANTOM_VOTE_AGAINST_VILLAGE_PLURALITY' },
      decisionIds: ['OD-33'],
    }),
  ],
});

export const mayor: RoleDefinition = role({
  id: 'mayor',
  displayName: 'Mayor',
  description: 'Votes count double from the start of the game.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-34'],
  abilities: [
    ability({
      id: 'mayor_vote',
      capability: 'VOTE_MODIFIER',
      timing: 'PASSIVE',
      usesPerPhase: null,
      config: { weight: 2, publicLeader: false },
      decisionIds: ['OD-34'],
    }),
  ],
});

export const bard: RoleDefinition = role({
  id: 'bard',
  displayName: 'Bard',
  description: 'No defined digital power yet. Cannot be seated.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'UNRESOLVED',
  decisionIds: ['OD-20'],
  victory: NO_VICTORY,
});

export const healerAssistant: RoleDefinition = role({
  id: 'healer_assistant',
  displayName: 'Healer Assistant',
  description: "Takes over the Doctor's save, with its remaining charges, when the Doctor dies or is converted.",
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  requiresRoleId: 'doctor',
  decisionIds: ['OD-32'],
  abilities: [
    ability({
      id: 'assistant_inherit',
      capability: 'TEAM_SUPPORT',
      handlerKey: 'assistant.inheritDoctor',
      timing: 'PASSIVE',
      usesPerPhase: null,
      usesPerGame: 1,
      config: { inheritsRoleId: 'doctor' },
      decisionIds: ['OD-32'],
    }),
  ],
});

export const SUPPORT_ROLES = [blacksmith, priest, elder, mayor, bard, healerAssistant];
