import { DEFAULT_CATALOG, isWolfAligned, type RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition } from '../catalog/types.js';
import { resolveEntry, type ResolvedEntry } from '../config/resolve.js';
import type { GameConfiguration } from '../config/types.js';
import type { Faction } from '../factions.js';
import type { AbilityId, PlayerId, RoleId } from '../snapshot.js';
import { fisherYates, type RandomInt } from './shuffle.js';

/** One ability granted at start. The API stores it as an `ability_instances` row. */
export interface DealtAbility {
  readonly abilityId: AbilityId;
  /** The ability with this game's overrides applied. Frozen onto the instance so a later catalog edit cannot change a running game. */
  readonly definition: AbilityDefinition;
  /** Uses left for the game. Null is unlimited. */
  readonly chargesRemaining: number | null;
  readonly availableFromRound: number;
}

/** One player's dealt role. The API stores it as a `role_assignments` row with original and current fields equal. */
export interface DealtRole {
  readonly playerId: PlayerId;
  readonly roleId: RoleId;
  readonly profileId: string;
  readonly faction: Faction;
  /** How Wolf / Non-Wolf checks read this player. */
  readonly wolfAligned: boolean;
  readonly abilities: readonly DealtAbility[];
}

/**
 * Deals the configuration's role multiset to the players. Each role entry
 * contributes `count` cards; the deck is shuffled with Fisher-Yates and dealt
 * in `playerIds` order, so seat order carries no information about roles.
 *
 * Call it only with a configuration that `validateConfiguration` accepted.
 * Anything it cannot deal is a programming error, so it throws rather than
 * dealing a partial table.
 */
export function dealRoles(
  config: GameConfiguration,
  playerIds: readonly PlayerId[],
  randomInt: RandomInt,
  catalog: RoleCatalog = DEFAULT_CATALOG,
): DealtRole[] {
  if (new Set(playerIds).size !== playerIds.length) throw new Error('dealRoles: a player id appears twice');

  const deck: ResolvedEntry[] = [];
  for (const entry of config.roles) {
    if (!Number.isInteger(entry.count) || entry.count < 0) throw new Error(`dealRoles: ${entry.roleId} has count ${entry.count}`);
    if (entry.count === 0) continue;
    const resolved = resolveEntry(entry, catalog);
    if (!resolved) throw new Error(`dealRoles: ${entry.roleId} does not resolve. Validate the configuration first.`);
    for (let i = 0; i < entry.count; i++) deck.push(resolved);
  }
  if (deck.length !== playerIds.length) {
    throw new Error(`dealRoles: ${deck.length} roles for ${playerIds.length} players`);
  }

  const shuffled = fisherYates(deck, randomInt);
  return playerIds.map((playerId, i) => {
    const card = shuffled[i]!;
    return {
      playerId,
      roleId: card.role.id,
      profileId: card.profile.id,
      faction: card.faction,
      wolfAligned: isWolfAligned(card.role, card.faction),
      abilities: card.abilities.map((definition) => ({
        abilityId: definition.id,
        definition,
        chargesRemaining: definition.usesPerGame,
        availableFromRound: definition.availableFromRound,
      })),
    };
  });
}
