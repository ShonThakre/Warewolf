import { ability, players, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section E of docs/werewolf/role-catalog.md. */

export const sniper: RoleDefinition = role({
  id: 'sniper',
  displayName: 'Sniper',
  description: 'One shot per game, fired during the day discussion before voting opens.',
  category: 'OFFENSE',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-29'],
  abilities: [
    ability({
      id: 'sniper_shot',
      capability: 'KILL',
      attackType: 'SNIPER',
      timing: 'DAY',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
      decisionIds: ['OD-29'],
    }),
  ],
});

export const poisoner: RoleDefinition = role({
  id: 'poisoner',
  displayName: 'Poisoner',
  description: 'Poisons one player once per game. The victim dies after the next day vote unless cured.',
  category: 'OFFENSE',
  defaultFaction: 'NEUTRAL',
  allowedFactions: ['NEUTRAL', 'VILLAGE', 'WOLF_PACK'],
  requiresFactionChoice: true,
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-28'],
  abilities: [
    ability({
      id: 'poisoner_poison',
      capability: 'POISON',
      attackType: 'POISON',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
      config: { delay: 'END_OF_NEXT_DAY_RESOLUTION' },
      decisionIds: ['OD-28'],
    }),
  ],
});

export const disruptor: RoleDefinition = role({
  id: 'disruptor',
  displayName: 'Disruptor',
  description: "Once per game, cancels every special ability one player used that night. Votes are not affected.",
  category: 'OFFENSE',
  defaultFaction: 'NEUTRAL',
  allowedFactions: ['NEUTRAL', 'VILLAGE', 'WOLF_PACK'],
  requiresFactionChoice: true,
  implementationStatus: 'CONFIRMED',
  decisionIds: ['OD-30'],
  abilities: [
    ability({
      id: 'disruptor_block',
      capability: 'BLOCK_ACTION',
      usesPerGame: 1,
      target: players(),
      resultAudience: ['HOST'],
      config: { informTarget: false },
      decisionIds: ['OD-30'],
    }),
  ],
});

export const OFFENSE_ROLES = [sniper, poisoner, disruptor];
