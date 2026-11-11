import {
  DEFAULT_CATALOG,
  DEFAULT_PACK_BY_MODE,
  MODE_BOUNDS,
  ROLE_PACKS,
  getPack,
  type AbilityOverride,
  type Faction,
  type GameConfiguration,
  type GameMode,
  type KillAggregation,
  type RoleEntry,
  type RolePack,
} from '@warewolf/domain';

/** The four setup steps from the UI plan, section 7B. */
export const SETUP_STEPS = ['mode', 'roles', 'settings', 'review'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function infectionLocked(draft: GameConfiguration): boolean {
  return draft.mode === 'INFECTION';
}

/** Infection Edition and Ultimate 20 refuse host edits. The roster and rules are the mode. */
export function modeLocked(draft: GameConfiguration): boolean {
  return draft.mode === 'INFECTION' || draft.mode === 'ULTIMATE_20';
}

export function roleCount(draft: GameConfiguration, roleId: string): number {
  return draft.roles.filter((entry) => entry.roleId === roleId).reduce((sum, entry) => sum + entry.count, 0);
}

export function packsForMode(mode: GameMode): readonly RolePack[] {
  return ROLE_PACKS.filter((pack) => pack.config.mode === mode);
}

export function configurationFromPack(packId: string): GameConfiguration | null {
  const pack = getPack(packId);
  return pack ? cloneConfiguration(pack.config) : null;
}

/** Stable comparison. Key order does not count as a change. */
export function sameConfiguration(left: GameConfiguration, right: GameConfiguration): boolean {
  return canonical(left) === canonical(right);
}

export function applyMode(draft: GameConfiguration, mode: GameMode): GameConfiguration {
  return applyPack(draft, DEFAULT_PACK_BY_MODE[mode]);
}

export function applyPack(draft: GameConfiguration, packId: string): GameConfiguration {
  const next = configurationFromPack(packId);
  if (!next || sameConfiguration(draft, next)) return draft;
  return next;
}

export function setPlayerCount(draft: GameConfiguration, count: number): GameConfiguration {
  if (modeLocked(draft) || !Number.isFinite(count)) return draft;
  const bounds = MODE_BOUNDS[draft.mode];
  const playerCount = Math.min(bounds.max, Math.max(bounds.min, Math.trunc(count)));
  if (playerCount === draft.playerCount) return draft;
  return customize({ ...draft, playerCount });
}

/** Adds or removes seats of one catalog role. Unresolved and unseatable roles are refused. */
export function setRoleCount(draft: GameConfiguration, roleId: string, count: number): GameConfiguration {
  if (modeLocked(draft)) return draft;
  const role = DEFAULT_CATALOG.byId.get(roleId);
  if (!role || !role.seatable || role.implementationStatus === 'UNRESOLVED') return draft;
  const nextCount = Math.max(0, role.uniqueInGame ? Math.min(1, Math.trunc(count)) : Math.trunc(count));
  const current = draft.roles.filter((entry) => entry.roleId === roleId);
  const currentCount = current.reduce((sum, entry) => sum + entry.count, 0);
  if (nextCount === currentCount && current.length <= 1) return draft;
  const kept = draft.roles.filter((entry) => entry.roleId !== roleId);
  if (nextCount === 0) return customize({ ...draft, roles: kept });
  const first = current[0];
  const entry: RoleEntry = first
    ? { ...first, count: nextCount }
    : { roleId: role.id, count: nextCount, ...(role.requiresFactionChoice ? { faction: role.defaultFaction } : {}) };
  return customize({ ...draft, roles: [...kept, entry] });
}

export function setRoleFaction(draft: GameConfiguration, roleId: string, faction: Faction): GameConfiguration {
  if (modeLocked(draft)) return draft;
  const role = DEFAULT_CATALOG.byId.get(roleId);
  if (!role?.requiresFactionChoice || !role.allowedFactions.includes(faction)) return draft;
  const current = draft.roles.find((entry) => entry.roleId === roleId);
  if (!current || (current.faction ?? role.defaultFaction) === faction) return draft;
  return customize({
    ...draft,
    roles: draft.roles.map((entry) => (entry.roleId === roleId ? { ...entry, faction } : entry)),
  });
}

/** Switches a multi-profile role. Clears overrides so the profiles are not mixed. */
export function setAbilityProfile(draft: GameConfiguration, roleId: string, profileId: string): GameConfiguration {
  if (modeLocked(draft)) return draft;
  const role = DEFAULT_CATALOG.byId.get(roleId);
  const entry = draft.roles.find((item) => item.roleId === roleId);
  if (!role || !entry || !role.profiles[profileId]) return draft;
  if ((entry.abilityProfile ?? role.defaultProfileId) === profileId) return draft;
  return customize({
    ...draft,
    roles: draft.roles.map((item) =>
      item.roleId === roleId
        ? { roleId: item.roleId, count: item.count, ...(item.faction ? { faction: item.faction } : {}), abilityProfile: profileId }
        : item,
    ),
  });
}

export function setAbilityCharge(
  draft: GameConfiguration,
  roleId: string,
  abilityId: string,
  usesPerGame: number | null,
): GameConfiguration {
  const found = editableAbility(draft, roleId, abilityId);
  if (!found) return draft;
  if (found.profile.chargePolicy === 'UNLIMITED') return draft;
  if (found.profile.chargePolicy === 'LIMITED' && usesPerGame === null) return draft;
  if (usesPerGame !== null && !isWhole(usesPerGame)) return draft;
  return writeOverride(draft, roleId, abilityId, { ...found.override, usesPerGame });
}

export function setAbilityCooldown(draft: GameConfiguration, roleId: string, abilityId: string, cooldownNights: number): GameConfiguration {
  const found = editableAbility(draft, roleId, abilityId);
  if (!found || !isWhole(cooldownNights)) return draft;
  return writeOverride(draft, roleId, abilityId, { ...found.override, cooldownNights });
}

/** Boolean and number keys that already exist on the ability. New keys and strings are refused. */
export function setAbilityConfig(
  draft: GameConfiguration,
  roleId: string,
  abilityId: string,
  key: string,
  value: boolean | number,
): GameConfiguration {
  const found = editableAbility(draft, roleId, abilityId);
  if (!found || typeof found.ability.config[key] !== typeof value) return draft;
  if (typeof value === 'number' && !Number.isFinite(value)) return draft;
  return writeOverride(draft, roleId, abilityId, {
    ...found.override,
    config: { ...found.override.config, [key]: value },
  });
}

export function setPacing(draft: GameConfiguration, pacing: GameConfiguration['pacing']): GameConfiguration {
  return editSettings(draft, (current) => {
    if (current.pacing === pacing && (pacing === 'HOST' ? current.timers === null : current.timers != null)) return current;
    if (pacing === 'HOST') return { ...current, pacing, timers: null };
    return { ...current, pacing, timers: current.timers ?? { nightSeconds: 90, daySeconds: 180, voteSeconds: 60 } };
  });
}

export function setTimer(
  draft: GameConfiguration,
  key: keyof NonNullable<GameConfiguration['timers']>,
  seconds: number,
): GameConfiguration {
  return editSettings(draft, (current) => {
    if (current.pacing !== 'TIMED' || !current.timers || !isWhole(seconds) || seconds > 3600) return current;
    if (current.timers[key] === seconds) return current;
    return { ...current, timers: { ...current.timers, [key]: seconds } };
  });
}

export function setRoundCap(draft: GameConfiguration, roundCap: number): GameConfiguration {
  return editSettings(draft, (current) => {
    if (!isWhole(roundCap) || roundCap < 1 || roundCap > 100 || current.roundCap === roundCap) return current;
    return { ...current, roundCap };
  });
}

export function setWolfCap(draft: GameConfiguration, wolfCap: number): GameConfiguration {
  return editSettings(draft, (current) => {
    if (!isWhole(wolfCap) || wolfCap > 30 || current.teams.wolfCap === wolfCap) return current;
    return { ...current, teams: { ...current.teams, wolfCap } };
  });
}

export function setKnowsTeammates(draft: GameConfiguration, knowsTeammates: boolean): GameConfiguration {
  return editSettings(draft, (current) =>
    current.wolves.knowsTeammates === knowsTeammates ? current : { ...current, wolves: { ...current.wolves, knowsTeammates } },
  );
}

export function setFriendlyFire(draft: GameConfiguration, friendlyFire: boolean): GameConfiguration {
  return editSettings(draft, (current) =>
    current.wolves.friendlyFire === friendlyFire ? current : { ...current, wolves: { ...current.wolves, friendlyFire } },
  );
}

export function setKillAggregation(draft: GameConfiguration, killAggregation: KillAggregation): GameConfiguration {
  return editSettings(draft, (current) =>
    current.wolves.killAggregation === killAggregation ? current : { ...current, wolves: { ...current.wolves, killAggregation } },
  );
}

export function setInfectionEnabled(draft: GameConfiguration, enabled: boolean): GameConfiguration {
  return editSettings(draft, (current) =>
    current.infection.enabled === enabled ? current : { ...current, infection: { ...current.infection, enabled } },
  );
}

export function setInfectionAnnouncement(draft: GameConfiguration, announcement: GameConfiguration['infection']['announcement']): GameConfiguration {
  return editSettings(draft, (current) =>
    current.infection.announcement === announcement ? current : { ...current, infection: { ...current.infection, announcement } },
  );
}

export function setInfectionSuccesses(draft: GameConfiguration, maxSuccesses: number): GameConfiguration {
  return editSettings(draft, (current) => {
    if (!isWhole(maxSuccesses) || maxSuccesses > 30 || current.infection.maxSuccesses === maxSuccesses) return current;
    return { ...current, infection: { ...current.infection, maxSuccesses } };
  });
}

export function setRequiresSurvival(draft: GameConfiguration, requiresSurvival: boolean): GameConfiguration {
  return editSettings(draft, (current) => {
    if (current.infection.requiresSurvival === requiresSurvival) return current;
    const choice = requiresSurvival ? 'SURVIVAL_REQUIRED' : 'CONVERT_BEFORE_DEATH';
    const rulesetAcknowledgments =
      current.rulesetAcknowledgments['OD-03'] === undefined
        ? current.rulesetAcknowledgments
        : { ...current.rulesetAcknowledgments, 'OD-03': choice };
    return { ...current, infection: { ...current.infection, requiresSurvival }, rulesetAcknowledgments };
  });
}

export function setVotingFlag(
  draft: GameConfiguration,
  key: 'enabled' | 'abstain' | 'changeUntilClose' | 'deadMayVote',
  value: boolean,
): GameConfiguration {
  return editSettings(draft, (current) =>
    current.voting[key] === value ? current : { ...current, voting: { ...current.voting, [key]: value } },
  );
}

export function setReveal(
  draft: GameConfiguration,
  key: 'revealOnDayElimination' | 'revealOnNightDeath',
  value: GameConfiguration['voting']['revealOnDayElimination'],
): GameConfiguration {
  return editSettings(draft, (current) =>
    current.voting[key] === value ? current : { ...current, voting: { ...current.voting, [key]: value } },
  );
}

export function setNightToggle(
  draft: GameConfiguration,
  key: keyof GameConfiguration['night']['toggles'],
  value: boolean,
): GameConfiguration {
  return editSettings(draft, (current) => {
    if (current.night.toggles[key] === value) return current;
    return { ...current, night: { ...current.night, toggles: { ...current.night.toggles, [key]: value } } };
  });
}

export function setAcknowledgement(draft: GameConfiguration, id: string, value: string): GameConfiguration {
  return editSettings(draft, (current) => {
    if (current.rulesetAcknowledgments[id] === value) return current;
    return { ...current, rulesetAcknowledgments: { ...current.rulesetAcknowledgments, [id]: value } };
  });
}

function cloneConfiguration(draft: GameConfiguration): GameConfiguration {
  return structuredClone(draft) as GameConfiguration;
}

/** A hand edit leaves the preset. Infection Edition never reaches this. */
function customize(draft: GameConfiguration): GameConfiguration {
  if (draft.rolePackId === 'custom') return draft;
  return { ...draft, rolePackId: 'custom' };
}

function editSettings(draft: GameConfiguration, recipe: (draft: GameConfiguration) => GameConfiguration): GameConfiguration {
  if (modeLocked(draft)) return draft;
  const next = recipe(draft);
  if (next === draft) return draft;
  return customize(next);
}

function editableAbility(draft: GameConfiguration, roleId: string, abilityId: string) {
  if (modeLocked(draft)) return null;
  const role = DEFAULT_CATALOG.byId.get(roleId);
  const entry = draft.roles.find((item) => item.roleId === roleId && item.count > 0);
  const profile = role && entry ? role.profiles[entry.abilityProfile ?? role.defaultProfileId] : undefined;
  const ability = profile?.abilities.find((item) => item.id === abilityId);
  if (!role || !entry || !profile || !ability) return null;
  return { override: entry.overrides?.[abilityId] ?? {}, profile, ability };
}

function writeOverride(draft: GameConfiguration, roleId: string, abilityId: string, override: AbilityOverride): GameConfiguration {
  return customize({
    ...draft,
    roles: draft.roles.map((entry) =>
      entry.roleId === roleId ? { ...entry, overrides: { ...entry.overrides, [abilityId]: override } } : entry,
    ),
  });
}

function isWhole(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }
  return value;
}
