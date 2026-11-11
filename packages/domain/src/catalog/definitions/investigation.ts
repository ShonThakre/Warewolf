import { ability, players, profile, role } from '../builders.js';
import type { RoleDefinition } from '../types.js';

/**
 * Section C of docs/werewolf/role-catalog.md. All Village, secret, lost on
 * infection, and distinct from Seeker. Results go to the actor and the host.
 * Every result reads the start-of-night snapshot (OD-38).
 */

const investigator = (input: {
  id: string;
  displayName: string;
  description: string;
  decisionId: string;
  ability: Parameters<typeof ability>[0];
}): RoleDefinition =>
  role({
    id: input.id,
    displayName: input.displayName,
    description: input.description,
    category: 'INVESTIGATION',
    defaultFaction: 'VILLAGE',
    implementationStatus: 'RECOMMENDED',
    decisionIds: [input.decisionId, 'OD-38'],
    abilities: [
      ability({ resultAudience: ['SELF', 'HOST'], decisionIds: [input.decisionId, 'OD-38'], ...input.ability }),
    ],
  });

export const detective = investigator({
  id: 'detective',
  displayName: 'Detective',
  description: 'Learns whether a player is a Wolf or a Non-Wolf. Two investigations per game.',
  decisionId: 'OD-23',
  ability: { id: 'detective_investigate', capability: 'INVESTIGATE', usesPerGame: 2, target: players(), result: 'ALIGNMENT_WOLF_OR_NOT' },
});

export const oracle = role({
  id: 'oracle',
  displayName: 'Oracle',
  description: "Every other night, learns a player's role category: Wolf, village power, plain villager, Neutral, or Independent.",
  category: 'INVESTIGATION',
  defaultFaction: 'VILLAGE',
  implementationStatus: 'RECOMMENDED',
  decisionIds: ['OD-21', 'OD-38'],
  defaultProfileId: 'oracle',
  profiles: [
    profile({
      id: 'oracle',
      status: 'RECOMMENDED',
      description: "Every other night, learns a player's role category: Wolf, village power, plain villager, Neutral, or Independent.",
      decisionIds: ['OD-21', 'OD-38'],
      abilities: [
        ability({
          id: 'oracle_investigate',
          capability: 'INVESTIGATE',
          cooldownNights: 1,
          target: players(),
          result: 'ROLE_CATEGORY',
          resultAudience: ['SELF', 'HOST'],
          decisionIds: ['OD-21', 'OD-38'],
        }),
      ],
    }),
    profile({
      id: 'oracle_alignment',
      status: 'RECOMMENDED',
      description: 'Ultimate 20. Each night, learns whether one living player is a Wolf or a Non-Wolf.',
      abilities: [
        ability({
          id: 'oracle_alignment',
          capability: 'INVESTIGATE',
          target: players(),
          result: 'ALIGNMENT_WOLF_OR_NOT',
          resultAudience: ['SELF', 'HOST'],
        }),
      ],
    }),
  ],
});

export const tracker = investigator({
  id: 'tracker',
  displayName: 'Tracker',
  description: 'Learns which players a target visited that night. Action types stay hidden.',
  decisionId: 'OD-27',
  ability: {
    id: 'tracker_track',
    capability: 'TRACK',
    target: players(),
    result: 'VISITED_PLAYER_IDS',
    config: { includesActionType: false },
  },
});

export const psychic = investigator({
  id: 'psychic',
  displayName: 'Psychic',
  description: 'Compares two players and learns whether they are on the same faction.',
  decisionId: 'OD-24',
  ability: {
    id: 'psychic_compare',
    capability: 'INVESTIGATE',
    target: players({ count: 2 }),
    result: 'SAME_OR_DIFFERENT_FACTION',
    config: { compare: 'CURRENT_FACTION' },
  },
});

export const medium = investigator({
  id: 'medium',
  displayName: 'Medium',
  description: 'Learns the role a dead player had when they died. No conversation with the dead.',
  decisionId: 'OD-25',
  ability: { id: 'medium_investigate', capability: 'INVESTIGATE', target: players({ life: 'DEAD' }), result: 'ROLE_AT_DEATH' },
});

export const prophet = investigator({
  id: 'prophet',
  displayName: 'Prophet',
  description: 'Every third night, asks one approved yes-or-no question about the game state.',
  decisionId: 'OD-26',
  ability: {
    id: 'prophet_ask',
    capability: 'DETECT',
    cooldownNights: 2,
    target: { kind: 'QUESTION', questions: ['WOLF_PACK_SIZE_AT_LEAST'] },
    result: 'YES_NO',
    // OD-26: "a configured integer". 3 is an engineering default; a game can override it.
    config: { packSizeAtLeast: 3 },
  },
});

export const seer = investigator({
  id: 'seer',
  displayName: 'Seer',
  description: "Every other night, learns a player's current role.",
  decisionId: 'OD-22',
  ability: {
    id: 'seer_investigate',
    capability: 'INVESTIGATE',
    cooldownNights: 1,
    target: players(),
    result: 'ROLE_ID',
    config: { accuracyPercent: 100 },
  },
});

export const INVESTIGATION_ROLES = [detective, oracle, tracker, psychic, medium, prophet, seer];
