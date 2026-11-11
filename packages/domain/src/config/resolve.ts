import type { RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition, AbilityProfile, RoleDefinition, VictoryDefinition } from '../catalog/types.js';
import type { Faction } from '../factions.js';
import type { AbilityOverride, RoleEntry } from './types.js';

/**
 * OD-73. A team-victory role seated as Neutral or Independent wins by being
 * alive when the game ends, beside the winning team, and does not end the game.
 * WW-902 reads `ResolvedEntry.victory`, which already has this applied.
 */
export const SURVIVE_VICTORY: VictoryDefinition = {
  type: 'INDIVIDUAL',
  trigger: 'ALIVE_AT_GAME_END',
  endGameOnWin: false,
  revealOnWin: false,
};

/** The victory this seat actually plays. Catalog profiles stay as written. */
export function victoryForSeat(victory: VictoryDefinition, faction: Faction): VictoryDefinition {
  if ((faction === 'NEUTRAL' || faction === 'INDEPENDENT') && victory.type === 'TEAM') return SURVIVE_VICTORY;
  return victory;
}

/** One configuration entry joined with its catalog definition and overrides applied. */
export interface ResolvedEntry {
  readonly entry: RoleEntry;
  readonly role: RoleDefinition;
  readonly profile: AbilityProfile;
  readonly faction: Faction;
  /** Catalog victory, rewritten for a Neutral or Independent team-victory seat (OD-73). */
  readonly victory: VictoryDefinition;
  /** The profile's abilities with this entry's overrides applied. */
  readonly abilities: readonly AbilityDefinition[];
}

export type OverrideProblem = { readonly abilityId: string; readonly reason: string };

/** Applies one override. Returns the problems instead of a partially applied ability. */
export function applyOverride(base: AbilityDefinition, override: AbilityOverride): AbilityDefinition | OverrideProblem[] {
  const problems: OverrideProblem[] = [];
  const at = (reason: string) => problems.push({ abilityId: base.id, reason });

  const config = { ...base.config };
  for (const [key, value] of Object.entries(override.config ?? {})) {
    if (!(key in base.config)) at(`config key "${key}" does not exist on this ability`);
    else if (typeof value !== typeof base.config[key]) at(`config key "${key}" must stay a ${typeof base.config[key]}`);
    else config[key] = value;
  }
  if (problems.length > 0) return problems;

  return {
    ...base,
    usesPerGame: override.usesPerGame === undefined ? base.usesPerGame : override.usesPerGame,
    usesPerPhase: override.usesPerPhase === undefined ? base.usesPerPhase : override.usesPerPhase,
    cooldownNights: override.cooldownNights ?? base.cooldownNights,
    config,
  };
}

/**
 * Resolves an entry for code that already knows the configuration is valid,
 * such as assignment in Phase 4. Returns null for anything the validator rejects.
 */
export function resolveEntry(entry: RoleEntry, catalog: RoleCatalog): ResolvedEntry | null {
  const role = catalog.byId.get(entry.roleId);
  const profile = role?.profiles[entry.abilityProfile ?? role.defaultProfileId];
  if (!role || !profile) return null;

  const abilities: AbilityDefinition[] = [];
  for (const base of profile.abilities) {
    const override = entry.overrides?.[base.id];
    const applied = override ? applyOverride(base, override) : base;
    if (Array.isArray(applied)) return null;
    abilities.push(applied);
  }
  const faction = entry.faction ?? role.defaultFaction;
  return { entry, role, profile, faction, victory: victoryForSeat(profile.victory, faction), abilities };
}
