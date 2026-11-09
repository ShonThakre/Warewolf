import { ability, players, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section D of docs/werewolf/role-catalog.md. Guard stays the Infection Edition protector. */

export const bodyguard: RoleDefinition = role({
  id: 'bodyguard',
  displayName: 'Bodyguard',
  description: 'Guards another player. If the wolves attack that player, the Bodyguard takes the hit instead.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-14'],
  abilities: [
    ability({
      id: 'bodyguard_protect',
      capability: 'PROTECT',
      cancels: ['WOLF_KILL'],
      target: players(),
      config: { redirectToSelf: true, redirectsPoison: false },
      decisionIds: ['OD-14', 'OD-48'],
    }),
  ],
});

export const shieldbearer: RoleDefinition = role({
  id: 'shieldbearer',
  displayName: 'Shieldbearer',
  description: 'Shields one player from the wolf kill each night. Cannot shield the same player two nights in a row.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  abilities: [
    ability({
      id: 'shieldbearer_protect',
      capability: 'PROTECT',
      cancels: ['WOLF_KILL'],
      target: players({ self: true, notSameAsLastRound: true }),
      decisionIds: ['OD-48'],
    }),
  ],
});

export const trapper: RoleDefinition = role({
  id: 'trapper',
  displayName: 'Trapper',
  description: 'Sets a trap on a player. Wolves who attack that player are revealed to the Trapper and their attack fails.',
  category: 'PROTECTION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-15'],
  abilities: [
    ability({
      id: 'trapper_trap',
      capability: 'DETECT',
      cancels: ['WOLF_KILL'],
      // Two successful traps per game. A charge is spent when a trap triggers, not when it is placed.
      usesPerGame: 2,
      target: players(),
      result: 'ATTACKER_IDS',
      resultAudience: ['SELF', 'HOST'],
      config: { chargeSpentOn: 'TRIGGER' },
      decisionIds: ['OD-15'],
    }),
  ],
});

export const PROTECTION_ROLES = [bodyguard, shieldbearer, trapper];
