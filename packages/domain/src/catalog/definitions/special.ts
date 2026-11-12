import { NO_VICTORY, ability, individual, players, profile, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section B of docs/werewolf/role-catalog.md: special and neutral roles. */

export const jester: RoleDefinition = role({
  id: 'jester',
  displayName: 'Jester',
  description: 'Wins by being eliminated in a day vote. The game continues after the win.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-08', 'OD-50'],
  abilities: [
    ability({
      id: 'jester_day_vote_win',
      capability: null,
      handlerKey: 'jester.onDayElimination',
      timing: 'PASSIVE',
      usesPerPhase: null,
      decisionIds: ['OD-08'],
    }),
  ],
  victory: individual('ELIMINATED_BY_DAY_VOTE'),
});

export const assassin: RoleDefinition = role({
  id: 'assassin',
  displayName: 'Assassin',
  description: 'Has a personal target. Two variants exist and are never merged.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  allowedFactions: ['NEUTRAL', 'VILLAGE', 'WOLF_PACK'],
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-09'],
  profiles: [
    profile({
      id: 'assassin_mark',
      status: 'CONFIRMED',
      description: 'On night 1, marks one living player. Wins if that player is later eliminated by anyone. Does not kill.',
      decisionIds: ['OD-09'],
      victory: individual('MARKED_TARGET_ELIMINATED'),
      abilities: [
        ability({
          id: 'assassin_mark',
          capability: null,
          handlerKey: 'assassin.onTargetEliminated',
          usesPerGame: 1,
          onlyRound: 1,
          target: players(),
          resultAudience: ['HOST'],
          decisionIds: ['OD-09'],
        }),
      ],
    }),
    profile({
      id: 'assassin_execute',
      status: 'UNRESOLVED',
      description: 'One special elimination tied to a day vote. Disabled until OD-09 says how it combines with the vote.',
      decisionIds: ['OD-09'],
      victory: NO_VICTORY,
    }),
  ],
});

export const cursedVillager: RoleDefinition = role({
  id: 'cursed_villager',
  displayName: 'Cursed Villager',
  description: 'Starts as a villager. Surviving a wolf attack turns them into an Infected Wolf if the wolf cap allows.',
  category: 'TRANSFORMATION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-06'],
  abilities: [
    ability({
      id: 'cursed_conversion',
      capability: null,
      handlerKey: 'cursed.onSurvivedWolfAttack',
      timing: 'PASSIVE',
      usesPerPhase: null,
      usesPerGame: 1,
      decisionIds: ['OD-06'],
    }),
  ],
});

export const loneWolf: RoleDefinition = role({
  id: 'lone_wolf',
  displayName: 'Lone Wolf',
  description: 'An independent wolf. Kills alone and wins as the last player standing.',
  category: 'INDEPENDENT',
  defaultFaction: 'INDEPENDENT',
  wolfAligned: true,
  implementationStatus: 'CONFIRMED',
  infectionTarget: 'INELIGIBLE',
  decisionIds: ['OD-10', 'OD-37'],
  abilities: [
    ability({
      id: 'lone_kill',
      capability: 'KILL',
      attackType: 'WOLF_KILL',
      target: players(),
      lostOnInfection: false,
      config: { separateAttack: true },
      decisionIds: ['OD-10', 'OD-37'],
    }),
  ],
  victory: individual('SOLE_SURVIVOR'),
});

export const immortal: RoleDefinition = role({
  id: 'immortal',
  displayName: 'Immortal',
  description: 'Survives one death. The charge never refreshes.',
  category: 'DEFENSIVE',
  defaultFaction: 'VILLAGE',
  allowedFactions: ['VILLAGE', 'NEUTRAL', 'WOLF_PACK', 'INDEPENDENT'],
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-12'],
  abilities: [
    ability({
      id: 'immortal_survive',
      capability: 'SURVIVE_DEATH',
      handlerKey: 'immortal.consumeCharge',
      timing: 'PASSIVE',
      usesPerPhase: null,
      usesPerGame: 1,
      decisionIds: ['OD-12'],
    }),
  ],
});

export const avenger: RoleDefinition = role({
  id: 'avenger',
  displayName: 'Avenger',
  description: 'If eliminated by a named killer or by a day-vote leader, takes that player down the next night.',
  category: 'REACTIVE',
  defaultFaction: 'VILLAGE',
  allowedFactions: ['VILLAGE', 'NEUTRAL', 'WOLF_PACK'],
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-13'],
  abilities: [
    ability({
      id: 'avenger_revenge',
      capability: 'REVENGE',
      handlerKey: 'avenger.queueRevenge',
      timing: 'PASSIVE',
      attackType: 'REVENGE',
      usesPerPhase: null,
      usesPerGame: 1,
      resultAudience: ['HOST'],
      decisionIds: ['OD-13'],
    }),
  ],
});

export const hermit: RoleDefinition = role({
  id: 'hermit',
  displayName: 'Hermit',
  description: 'No defined power or victory yet. Cannot be seated.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'UNRESOLVED',
  decisionIds: ['OD-11'],
  victory: NO_VICTORY,
});

export const SPECIAL_ROLES = [jester, assassin, cursedVillager, loneWolf, immortal, avenger, hermit];
