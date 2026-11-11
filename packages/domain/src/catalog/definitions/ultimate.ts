import { ability, individual, players, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/**
 * Ultimate 20 roles (docs/werewolf/ultimate-20-rules.md). Alpha Wolf and
 * Oracle keep their default profiles and gain `alpha_ultimate` and
 * `oracle_alignment` beside them. These fourteen are new catalog ids.
 * Recommended, so a game that seats them warns UNCONFIRMED_PRESET.
 */

const wolf = {
  category: 'CORE' as const,
  defaultFaction: 'WOLF_PACK' as const,
  implementationStatus: 'RECOMMENDED' as const,
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE' as const,
};

export const shadowWolf: RoleDefinition = role({
  id: 'shadow_wolf',
  displayName: 'Shadow Wolf',
  description: 'Each night, cancels one living player’s special action. Does not kill.',
  ...wolf,
  abilities: [
    ability({
      id: 'shadow_block',
      capability: 'BLOCK_ACTION',
      target: players(),
      lostOnInfection: false,
      resultAudience: ['HOST'],
    }),
  ],
});

export const vampire: RoleDefinition = role({
  id: 'vampire',
  displayName: 'Vampire',
  description: 'Each night, marks one player. Two nights later that player becomes a Servant, if both are still alive.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  abilities: [
    ability({
      id: 'vampire_mark',
      capability: 'CONVERT',
      target: players(),
      resultAudience: ['HOST'],
    }),
  ],
  victory: individual('ALIVE_WITH_SERVANT'),
});

export const vampireServant: RoleDefinition = role({
  id: 'vampire_servant',
  displayName: 'Vampire Servant',
  description: 'A player the Vampire converted. No night power. Never dealt at the start.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'RECOMMENDED',
  seatable: false,
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  victory: individual('WITH_VAMPIRE'),
});

export const joker: RoleDefinition = role({
  id: 'joker',
  displayName: 'Joker',
  description: 'Wins by being eliminated in a day vote. The game continues after the win.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'joker_day_vote_win',
      capability: null,
      handlerKey: 'jester.onDayElimination',
      timing: 'PASSIVE',
      usesPerPhase: null,
    }),
  ],
  victory: individual('ELIMINATED_BY_DAY_VOTE'),
});

export const timeWizard: RoleDefinition = role({
  id: 'time_wizard',
  displayName: 'Time Wizard',
  description: 'Once per game, erases every action one other player took tonight, including a block.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'time_rewind',
      capability: 'REWIND',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
    }),
  ],
});

export const guardian: RoleDefinition = role({
  id: 'guardian',
  displayName: 'Guardian',
  description: 'Protects one player from the wolf kill each night, including themselves. Not the same player two nights in a row. Does not stop poison.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'guardian_protect',
      capability: 'PROTECT',
      cancels: ['WOLF_KILL'],
      target: players({ self: true, notSameAsLastRound: true }),
    }),
  ],
});

export const alchemist: RoleDefinition = role({
  id: 'alchemist',
  displayName: 'Alchemist',
  description: 'Three potions, each once per game, and any of them on the same night: heal, poison, or silence.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'alchemist_heal',
      capability: 'HEAL',
      cancels: ['WOLF_KILL', 'POISON'],
      usesPerGame: 1,
      target: players({ self: true }),
      resultAudience: ['SELF', 'HOST'],
    }),
    ability({
      id: 'alchemist_poison',
      capability: 'POISON',
      attackType: 'POISON',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
    }),
    ability({
      id: 'alchemist_silence',
      capability: 'SILENCE',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['PUBLIC', 'HOST'],
    }),
  ],
});

export const fox: RoleDefinition = role({
  id: 'fox',
  displayName: 'Fox',
  description: 'Each night, learns one player’s current team. Wins by being alive when no wolf remains.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  abilities: [
    ability({
      id: 'fox_investigate',
      capability: 'INVESTIGATE',
      target: players(),
      result: 'FACTION',
      resultAudience: ['SELF', 'HOST'],
    }),
  ],
  victory: individual('ALL_WOLVES_ELIMINATED_WHILE_ALIVE'),
});

export const mimic: RoleDefinition = role({
  id: 'mimic',
  displayName: 'Mimic',
  description: 'Once per game, copies a dead player’s usable abilities. Each copy has one charge, and using one drops the others.',
  category: 'TRANSFORMATION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'mimic_copy',
      capability: 'ROLE_COPY',
      usesPerGame: 1,
      target: players({ life: 'DEAD' }),
      resultAudience: ['SELF', 'HOST'],
      config: { copyCharges: true, untilUsed: true },
    }),
  ],
});

export const ghost: RoleDefinition = role({
  id: 'ghost',
  displayName: 'Ghost',
  description: 'The night after dying, sends one short hint. It cannot name a player or a seat.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  abilities: [
    ability({
      id: 'ghost_hint',
      capability: 'HINT',
      usesPerGame: 1,
      target: { kind: 'TEXT', maxLength: 140 },
      resultAudience: ['PUBLIC', 'HOST'],
      config: { actsWhileDead: true },
    }),
  ],
});

export const mindController: RoleDefinition = role({
  id: 'mind_controller',
  displayName: 'Mind Controller',
  description: 'Up to twice per game, during the day, redirects one living voter’s ballot onto another living player.',
  category: 'INDEPENDENT',
  defaultFaction: 'INDEPENDENT',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  abilities: [
    ability({
      id: 'mind_control',
      capability: 'MODIFY_VOTING',
      timing: 'DAY',
      usesPerGame: 2,
      target: players({ count: 2 }),
      resultAudience: ['HOST'],
    }),
  ],
  victory: individual('ALIVE_AT_GAME_END'),
});

export const necromancer: RoleDefinition = role({
  id: 'necromancer',
  displayName: 'Necromancer',
  description: 'Each night, returns one dead player for the next night. They stay dead for every rule: no vote and no ability.',
  category: 'NEUTRAL',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  abilities: [
    ability({
      id: 'necro_revive',
      capability: 'REVIVE',
      target: players({ life: 'DEAD' }),
      resultAudience: ['PUBLIC', 'HOST'],
    }),
  ],
  victory: individual('ALIVE_AFTER_REVIVE'),
});

export const doubleAgent: RoleDefinition = role({
  id: 'double_agent',
  displayName: 'Double Agent',
  description: 'Starts with the Village and has no night power. Infection turns them into a wolf and tells them privately.',
  category: 'DECEPTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
});

export const chaosDemon: RoleDefinition = role({
  id: 'chaos_demon',
  displayName: 'Chaos Demon',
  description: 'Each night, the server draws one Chaos event. Wins after three events change the game, while alive among five or fewer players.',
  category: 'INDEPENDENT',
  defaultFaction: 'INDEPENDENT',
  implementationStatus: 'RECOMMENDED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  abilities: [
    ability({
      id: 'chaos_event',
      capability: 'CHAOS',
      target: { kind: 'NONE' },
      resultAudience: ['PUBLIC', 'HOST'],
    }),
  ],
  victory: individual('CHAOS_THREE_AND_FINAL_FIVE'),
});

export const ULTIMATE_ROLES: readonly RoleDefinition[] = [
  shadowWolf,
  vampire,
  vampireServant,
  joker,
  timeWizard,
  guardian,
  alchemist,
  fox,
  mimic,
  ghost,
  mindController,
  necromancer,
  doubleAgent,
  chaosDemon,
];
