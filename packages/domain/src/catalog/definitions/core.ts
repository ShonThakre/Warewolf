import { ability, players, profile, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section A of docs/werewolf/role-catalog.md, plus Pack Wolf (37). */

const wolfKill = (id: string, extra: Partial<Parameters<typeof ability>[0]> = {}) =>
  ability({
    id,
    capability: 'KILL',
    attackType: 'WOLF_KILL',
    target: players(),
    resultAudience: [],
    lostOnInfection: false,
    ...extra,
  });

export const alphaWolf: RoleDefinition = role({
  id: 'alpha_wolf',
  displayName: 'Alpha Wolf',
  description: 'Leads the infection. Each night may try to turn one player into a wolf, and may submit a kill.',
  category: 'CORE',
  defaultFaction: 'WOLF_PACK',
  implementationStatus: 'CONFIRMED',
  uniqueInGame: true,
  infectionTarget: 'INELIGIBLE',
  infectionSource: 'SEAL_INFECTION_ON_DEATH',
  decisionIds: ['OD-01', 'OD-03', 'OD-04', 'OD-05'],
  defaultProfileId: 'alpha_wolf',
  profiles: [
    profile({
      id: 'alpha_wolf',
      status: 'CONFIRMED',
      description: 'Infection Edition and Expanded. One infection attempt and one wolf kill each night.',
      decisionIds: ['OD-01', 'OD-03', 'OD-04', 'OD-05'],
      abilities: [
        ability({
          id: 'alpha_infect',
          capability: 'INFECT',
          handlerKey: 'infection.convert',
          // One attempt per night. Successful conversions are capped by the configuration.
          target: players(),
          resultAudience: ['HOST'],
          lostOnInfection: false,
          decisionIds: ['OD-03', 'OD-04', 'OD-05', 'OD-47'],
        }),
        wolfKill('alpha_kill', { decisionIds: ['OD-01'] }),
      ],
    }),
    profile({
      id: 'alpha_ultimate',
      status: 'CONFIRMED',
      description: 'Ultimate 20. Each night, either kill one player or infect one player.',
      abilities: [
        ability({
          id: 'alpha_u20_infect',
          capability: 'INFECT',
          handlerKey: 'infection.convert',
          target: players(),
          resultAudience: ['HOST'],
          lostOnInfection: false,
          config: { exclusiveGroup: 'alpha_choice' },
        }),
        wolfKill('alpha_u20_kill', { lostOnInfection: false, config: { exclusiveGroup: 'alpha_choice' } }),
      ],
    }),
  ],
});

export const infectedWolf: RoleDefinition = role({
  id: 'infected_wolf',
  displayName: 'Infected Wolf',
  description: 'A player converted by infection. Submits a wolf kill from the next night on. Never dealt at start.',
  category: 'CORE',
  defaultFaction: 'WOLF_PACK',
  implementationStatus: 'CONFIRMED',
  seatable: false,
  infectionTarget: 'INELIGIBLE',
  abilities: [wolfKill('infected_kill', { decisionIds: ['OD-07'] })],
});

export const seeker: RoleDefinition = role({
  id: 'seeker',
  displayName: 'Seeker',
  description: 'Learns whether one living player is a Wolf or a Non-Wolf.',
  category: 'INVESTIGATION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  abilities: [
    ability({
      id: 'seeker_investigate',
      capability: 'INVESTIGATE',
      target: players(),
      result: 'ALIGNMENT_WOLF_OR_NOT',
      resultAudience: ['SELF', 'HOST'],
      decisionIds: ['OD-38'],
    }),
    ability({
      id: 'seeker_public_reveal',
      capability: 'ROLE_REVEAL',
      timing: 'DAY',
      target: { kind: 'OWN_RESULT' },
      resultAudience: ['PUBLIC'],
    }),
  ],
});

export const guard: RoleDefinition = role({
  id: 'guard',
  displayName: 'Guard',
  description: 'Protects one player from the wolf kill each night. Cannot protect the same player two nights in a row.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  abilities: [
    ability({
      id: 'guard_protect',
      capability: 'PROTECT',
      // OD-29: a night's protection covers its target through the next day's Sniper shot.
      cancels: ['WOLF_KILL', 'SNIPER'],
      target: players({ self: true, notSameAsLastRound: true }),
      decisionIds: ['OD-47', 'OD-48'],
    }),
  ],
});

const doctorSave = (extra: Partial<Parameters<typeof ability>[0]>) =>
  ability({ id: 'doctor_save', capability: 'HEAL', cancels: ['WOLF_KILL', 'SNIPER'], resultAudience: ['SELF', 'HOST'], ...extra });

export const doctor: RoleDefinition = role({
  id: 'doctor',
  displayName: 'Doctor',
  description: 'Saves a player from the wolf kill.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-02'],
  profiles: [
    profile({
      id: 'doctor_infection',
      status: 'CONFIRMED',
      description: 'Infection Edition. Told the final wolf target privately, then saves or declines. Unlimited saves, self-save allowed.',
      decisionIds: ['OD-02'],
      chargePolicy: 'UNLIMITED',
      abilities: [
        doctorSave({
          timing: 'NIGHT_REACTION',
          usesPerGame: null,
          target: { kind: 'FINAL_WOLF_TARGET' },
          config: { mode: 'INFORMED_VETO' },
          decisionIds: ['OD-02'],
        }),
      ],
    }),
    profile({
      id: 'doctor_limited',
      status: 'CONFIRMED',
      description: 'Expanded presets. A finite number of saves, blind by default.',
      decisionIds: ['OD-02'],
      chargePolicy: 'LIMITED',
      abilities: [
        doctorSave({
          usesPerGame: 2,
          target: players({ self: true }),
          config: { mode: 'BLIND_TARGET' },
          decisionIds: ['OD-02'],
        }),
      ],
    }),
    profile({
      id: 'doctor_blind',
      status: 'CONFIRMED',
      description: 'Classic. Picks a player to save during the night without knowing the target. Unlimited, configurable down.',
      decisionIds: ['OD-02'],
      abilities: [
        doctorSave({
          usesPerGame: null,
          target: players({ self: true }),
          config: { mode: 'BLIND_TARGET' },
          decisionIds: ['OD-02'],
        }),
      ],
    }),
  ],
});

export const witch: RoleDefinition = role({
  id: 'witch',
  displayName: 'Witch',
  description: 'Has one save potion and one poison potion for the whole game. May use both on the same night.',
  category: 'SUPPORT',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  abilities: [
    ability({
      id: 'witch_save',
      capability: 'HEAL',
      cancels: ['WOLF_KILL'],
      usesPerGame: 1,
      target: players({ self: true }),
      resultAudience: ['SELF', 'HOST'],
      decisionIds: ['OD-28', 'OD-49'],
    }),
    ability({
      id: 'witch_poison',
      capability: 'POISON',
      attackType: 'POISON',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
      decisionIds: ['OD-28', 'OD-49'],
    }),
  ],
});

export const normalVillager: RoleDefinition = role({
  id: 'normal_villager',
  displayName: 'Villager',
  description: 'No night power. Votes during the day.',
  category: 'CORE',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
});

export const packWolf: RoleDefinition = role({
  id: 'pack_wolf',
  displayName: 'Pack Wolf',
  description: 'Classic wolf. Submits a wolf kill each night. Knows the other Pack Wolves when the game allows it.',
  category: 'CORE',
  defaultFaction: 'WOLF_PACK',
  implementationStatus: 'CONFIRMED',
  infectionTarget: 'INELIGIBLE',
  decisionIds: ['OD-35', 'OD-36', 'OD-37'],
  abilities: [wolfKill('pack_kill', { decisionIds: ['OD-36', 'OD-37'] })],
});

export const CORE_ROLES = [alphaWolf, infectedWolf, seeker, guard, doctor, witch, normalVillager, packWolf];
