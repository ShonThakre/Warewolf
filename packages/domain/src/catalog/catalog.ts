import type { Faction } from '../factions.js';
import type { RoleId } from '../snapshot.js';
import { canonicalJson, deepFreeze } from '../util/canonical.js';
import { sha256Hex } from '../util/sha256.js';
import { CORE_ROLES } from './definitions/core.js';
import { DECEPTION_ROLES } from './definitions/deception.js';
import { INVESTIGATION_ROLES } from './definitions/investigation.js';
import { OFFENSE_ROLES } from './definitions/offense.js';
import { PROTECTION_ROLES } from './definitions/protection.js';
import { SPECIAL_ROLES } from './definitions/special.js';
import { SUPPORT_ROLES } from './definitions/support.js';
import type { AbilityProfile, RoleDefinition } from './types.js';

export interface RoleCatalog {
  readonly roles: readonly RoleDefinition[];
  readonly byId: ReadonlyMap<RoleId, RoleDefinition>;
  /** SHA-256 of the canonical definitions. Frozen onto each game at start. */
  readonly hash: string;
}

/**
 * Builds a frozen catalog and fails fast on a malformed definition. These are
 * programming errors in the catalog source, not host input, so they throw.
 */
export function createCatalog(definitions: readonly RoleDefinition[]): RoleCatalog {
  const problems = catalogProblems(definitions);
  if (problems.length > 0) throw new Error(`Invalid role catalog:\n- ${problems.join('\n- ')}`);

  // Definitions are plain JSON data, so a JSON round-trip is a faithful deep copy.
  const roles: readonly RoleDefinition[] = deepFreeze(JSON.parse(JSON.stringify(definitions)) as RoleDefinition[]);
  return Object.freeze({
    roles,
    byId: new Map(roles.map((r) => [r.id, r])),
    hash: sha256Hex(canonicalJson(roles)),
  });
}

export function catalogProblems(definitions: readonly RoleDefinition[]): string[] {
  const problems: string[] = [];
  const roleIds = new Set<string>();
  const abilityOwners = new Map<string, string>();

  for (const role of definitions) {
    if (roleIds.has(role.id)) problems.push(`duplicate role id ${role.id}`);
    roleIds.add(role.id);

    if (!role.allowedFactions.includes(role.defaultFaction)) {
      problems.push(`${role.id}: default faction ${role.defaultFaction} is not allowed`);
    }
    if (!role.profiles[role.defaultProfileId]) problems.push(`${role.id}: missing default profile ${role.defaultProfileId}`);
    if (role.implementationStatus === 'UNRESOLVED' && role.seatable && Object.values(role.profiles).some((p) => p.abilities.length > 0)) {
      problems.push(`${role.id}: unresolved roles must have no abilities`);
    }

    for (const profile of Object.values(role.profiles)) {
      if (profile.status === 'UNRESOLVED' && profile.abilities.length > 0) {
        problems.push(`${role.id}/${profile.id}: unresolved profiles must have no abilities`);
      }
      for (const a of profile.abilities) {
        const owner = abilityOwners.get(a.id);
        if (owner && owner !== role.id) problems.push(`ability id ${a.id} is used by ${owner} and ${role.id}`);
        abilityOwners.set(a.id, role.id);

        if (a.capability === null && a.handlerKey === null) problems.push(`${a.id}: needs a capability or a handlerKey`);
        if (a.usesPerGame !== null && a.usesPerGame < 0) problems.push(`${a.id}: negative usesPerGame`);
        if (a.usesPerPhase !== null && a.usesPerPhase < 0) problems.push(`${a.id}: negative usesPerPhase`);
        if (a.usesPerPhase !== null && a.usesPerGame !== null && a.usesPerPhase > a.usesPerGame) {
          problems.push(`${a.id}: usesPerPhase above usesPerGame`);
        }
        if (a.cooldownNights < 0) problems.push(`${a.id}: negative cooldown`);
        if ((a.capability === 'KILL' || a.capability === 'POISON' || a.capability === 'REVENGE') && a.attackType === null) {
          problems.push(`${a.id}: ${a.capability} needs an attackType`);
        }
        if ((a.capability === 'PROTECT' || a.capability === 'HEAL') && a.cancels.length === 0) {
          problems.push(`${a.id}: ${a.capability} must cancel at least one attack type`);
        }
      }
    }
  }

  for (const role of definitions) {
    if (role.requiresRoleId && !roleIds.has(role.requiresRoleId)) {
      problems.push(`${role.id}: requires unknown role ${role.requiresRoleId}`);
    }
  }
  return problems;
}

/** The 37 definitions: the brief's 36 roles plus `pack_wolf`. */
export const DEFAULT_CATALOG: RoleCatalog = createCatalog([
  ...CORE_ROLES,
  ...SPECIAL_ROLES,
  ...INVESTIGATION_ROLES,
  ...PROTECTION_ROLES,
  ...OFFENSE_ROLES,
  ...DECEPTION_ROLES,
  ...SUPPORT_ROLES,
]);

export function getProfile(role: RoleDefinition, profileId?: string): AbilityProfile | undefined {
  return role.profiles[profileId ?? role.defaultProfileId];
}

/** Wolf / Non-Wolf reading. The pack is wolf-aligned; others only when the role says so (Lone Wolf). */
export function isWolfAligned(role: RoleDefinition, faction: Faction): boolean {
  return faction === 'WOLF_PACK' || role.wolfAligned === true;
}

/** UNRESOLVED if either the role or the chosen profile is unresolved. */
export function effectiveStatus(role: RoleDefinition, profile: AbilityProfile) {
  if (role.implementationStatus === 'UNRESOLVED' || profile.status === 'UNRESOLVED') return 'UNRESOLVED' as const;
  if (role.implementationStatus === 'RECOMMENDED' || profile.status === 'RECOMMENDED') return 'RECOMMENDED' as const;
  return 'CONFIRMED' as const;
}
