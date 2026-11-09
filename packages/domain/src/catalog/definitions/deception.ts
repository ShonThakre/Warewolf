import { NO_VICTORY, ability, players, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/** Section F of docs/werewolf/role-catalog.md: transformation and deception. */

export const shapeshifter: RoleDefinition = role({
  id: 'shapeshifter',
  displayName: 'Shapeshifter',
  description: "Copies one player's active abilities for the next night, with a fresh set of charges.",
  category: 'TRANSFORMATION',
  defaultFaction: 'NEUTRAL',
  allowedFactions: ['NEUTRAL', 'VILLAGE', 'WOLF_PACK'],
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-31', 'OD-58'],
  abilities: [
    ability({
      id: 'shapeshifter_copy',
      capability: 'ROLE_COPY',
      handlerKey: 'shapeshifter.scheduleCopy',
      target: players(),
      resultAudience: ['SELF', 'HOST'],
      config: { durationNights: 1, permanentSteal: false },
      decisionIds: ['OD-31', 'OD-58'],
    }),
  ],
});

export const confuser: RoleDefinition = role({
  id: 'confuser',
  displayName: 'Confuser',
  description: 'No defined mechanic yet. Cannot be seated.',
  category: 'DECEPTION',
  defaultFaction: 'NEUTRAL',
  implementationStatus: 'UNRESOLVED',
  decisionIds: ['OD-18'],
  victory: NO_VICTORY,
});

export const spy: RoleDefinition = role({
  id: 'spy',
  displayName: 'Spy',
  description: 'Learns how many wolf-kill submissions were made that night. No names and no targets.',
  category: 'DECEPTION',
  defaultFaction: 'VILLAGE',
  allowedFactions: ['VILLAGE', 'NEUTRAL', 'WOLF_PACK'],
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-19', 'OD-46'],
  abilities: [
    ability({
      id: 'spy_count',
      capability: 'DETECT',
      result: 'WOLF_KILL_SUBMISSION_COUNT',
      resultAudience: ['SELF', 'HOST'],
      decisionIds: ['OD-19'],
    }),
  ],
});

export const DECEPTION_ROLES = [shapeshifter, confuser, spy];
