import { DEFAULT_CATALOG, effectiveStatus, isWolfAligned, type RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition } from '../catalog/types.js';
import { FACTIONS, type Faction } from '../factions.js';
import { BLOCKING_DECISIONS } from './decisions.js';
import { INFECTION_EDITION_LIMITS, MODE_BOUNDS, WOLF_CAP_OVERRIDE_ACK } from './modes.js';
import { INFECTION_CORE_ROLES, PACK_STATUS, ULTIMATE_20_ROLES } from './packs.js';
import { applyOverride, victoryForSeat, type ResolvedEntry } from './resolve.js';
import type { GameConfiguration } from './types.js';

/**
 * `validateConfiguration` is pure. The API calls it when the lobby saves a
 * draft and again inside the start transaction.
 * See docs/werewolf/role-configuration.md, section 2.
 */

export const VALIDATION_ERROR_CODES = [
  'ROLE_COUNT_MISMATCH',
  'PLAYER_BOUNDS',
  'UNKNOWN_ROLE',
  'UNKNOWN_PROFILE',
  'ROLE_UNRESOLVED',
  'INFECTED_SEATED',
  'INFECTION_WITHOUT_ALPHA',
  'MULTIPLE_ALPHAS',
  'WOLF_CAP',
  'WOLF_CAP_ABOVE_MODE',
  'NEUTRAL_VICTORY_MISSING',
  'FACTION_NOT_ALLOWED',
  'FACTION_REQUIRED',
  'TEAM_TARGET_MISMATCH',
  'DOCTOR_PROFILE_MIX',
  'DUPLICATE_ACTIVE_HEAL',
  'ABILITY_LIMIT_INVALID',
  'OVERRIDE_INVALID',
  'VOTE_WEIGHT_DOMINANT',
  'NO_TERMINAL_PATH',
  'NO_WOLVES',
  'CONTRADICTION',
  'PACK_DEPENDENCY',
  'PACING_TIMERS_MISSING',
  'MODE_RULE_LOCKED',
  'DECISION_UNSET',
  'DECISION_MISMATCH',
] as const;

export const VALIDATION_WARNING_CODES = [
  'WOLF_RATIO_HIGH',
  'WOLF_RATIO_LOW',
  'INFECTION_CAN_REACH_PARITY',
  'INFO_ROLE_DENSITY',
  'PROTECTION_DENSITY',
  'NEUTRAL_DENSITY',
  'VOTE_WEIGHT_HIGH',
  'UNCONFIRMED_PRESET',
] as const;

export const VALIDATION_INFO_CODES = ['INFORMED_DOCTOR'] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];
export type ValidationWarningCode = (typeof VALIDATION_WARNING_CODES)[number];
export type ValidationInfoCode = (typeof VALIDATION_INFO_CODES)[number];
export type ValidationCode = ValidationErrorCode | ValidationWarningCode | ValidationInfoCode;

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly severity: Severity;
  /** Describes the host's own draft, so it may name role ids. */
  readonly message: string;
  readonly roleId?: string;
  readonly abilityId?: string;
  readonly decisionIds?: readonly string[];
}

/** Derived totals the lobby shows. Hosts never type these. */
export interface TeamSummary {
  readonly playerCount: number;
  readonly selectedSeats: number;
  readonly remainingSeats: number;
  readonly factions: Readonly<Record<Faction, number>>;
  readonly startingPack: number;
  readonly wolfCap: number;
  readonly infectionSuccesses: number | null;
}

export interface ValidationResult {
  /** True when there are no errors. Warnings still need acknowledgement to start. */
  readonly valid: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  readonly infos: readonly ValidationIssue[];
  readonly summary: TeamSummary;
}

/** Start is allowed with no errors, and with warnings only when the host acknowledged them. */
export function canStart(result: ValidationResult, options: { acknowledgeWarnings: boolean }): boolean {
  return result.valid && (result.warnings.length === 0 || options.acknowledgeWarnings);
}

const SEVERITY: Record<ValidationCode, Severity> = Object.fromEntries([
  ...VALIDATION_ERROR_CODES.map((c) => [c, 'error']),
  ...VALIDATION_WARNING_CODES.map((c) => [c, 'warning']),
  ...VALIDATION_INFO_CODES.map((c) => [c, 'info']),
]) as Record<ValidationCode, Severity>;

const unique = (ids: readonly string[]) => [...new Set(ids)];
const isCount = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const isLimit = (n: unknown) => n === null || isCount(n);

export function validateConfiguration(config: GameConfiguration, catalog: RoleCatalog = DEFAULT_CATALOG): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (code: ValidationCode, message: string, extra: Omit<ValidationIssue, 'code' | 'severity' | 'message'> = {}) =>
    issues.push({ code, severity: SEVERITY[code], message, ...extra });

  const n = config.playerCount;

  // Game bounds
  const bounds = MODE_BOUNDS[config.mode];
  if (!Number.isInteger(n) || n < bounds.min || n > bounds.max) {
    add('PLAYER_BOUNDS', bounds.min === bounds.max
      ? `${config.mode} needs exactly ${bounds.min} players, not ${n}.`
      : `${config.mode} needs ${bounds.min} to ${bounds.max} players, not ${n}.`);
  }
  if (config.pacing === 'TIMED' && config.timers === null) add('PACING_TIMERS_MISSING', 'Timed pacing needs night, day, and vote durations.');

  // Entries
  const seated: { resolved: ResolvedEntry; count: number; status: 'CONFIRMED' | 'RECOMMENDED' | 'UNRESOLVED' }[] = [];
  let selected = 0;

  for (const entry of config.roles) {
    if (!isCount(entry.count)) {
      add('ROLE_COUNT_MISMATCH', `Count for ${entry.roleId} must be a whole number of seats, not ${entry.count}.`, { roleId: entry.roleId });
      continue;
    }
    selected += entry.count;
    if (entry.count === 0) continue;

    const role = catalog.byId.get(entry.roleId);
    if (!role) {
      add('UNKNOWN_ROLE', `"${entry.roleId}" is not in the role catalog.`, { roleId: entry.roleId });
      continue;
    }
    const profileId = entry.abilityProfile ?? role.defaultProfileId;
    const profile = role.profiles[profileId];
    if (!profile) {
      add('UNKNOWN_PROFILE', `${role.displayName} has no profile "${profileId}".`, { roleId: role.id });
      continue;
    }

    const status = effectiveStatus(role, profile);
    const decisionIds = unique([...role.decisionIds, ...profile.decisionIds]);
    if (status === 'UNRESOLVED') {
      add('ROLE_UNRESOLVED', `${role.displayName}${profileId === role.id ? '' : ` (${profileId})`} has no approved mechanic yet. See ${decisionIds.join(', ')}.`, { roleId: role.id, decisionIds });
    }
    if (!role.seatable) {
      add('INFECTED_SEATED', `${role.displayName} only appears through conversion and cannot be dealt at start.`, { roleId: role.id });
    }

    if (entry.faction === undefined && role.requiresFactionChoice) {
      add('FACTION_REQUIRED', `${role.displayName} must be given a faction: ${role.allowedFactions.join(', ')}.`, { roleId: role.id });
    }
    const faction = entry.faction ?? role.defaultFaction;
    if (!role.allowedFactions.includes(faction)) {
      add('FACTION_NOT_ALLOWED', `${role.displayName} cannot be ${faction}. Allowed: ${role.allowedFactions.join(', ')}.`, { roleId: role.id });
    }
    // OD-73: a team victory seated as Neutral or Independent becomes a survive win.
    // A seat that still has no victory, other than an unresolved role, cannot start.
    const seatedVictory = victoryForSeat(profile.victory, faction);
    if ((faction === 'NEUTRAL' || faction === 'INDEPENDENT') && seatedVictory.type !== 'INDIVIDUAL' && status !== 'UNRESOLVED') {
      add('NEUTRAL_VICTORY_MISSING', `${role.displayName} as ${faction} has no victory defined.`, { roleId: role.id, decisionIds: ['OD-73'] });
    }

    // Overrides
    const abilities: AbilityDefinition[] = [];
    let overridesOk = true;
    for (const abilityId of Object.keys(entry.overrides ?? {})) {
      if (!profile.abilities.some((a) => a.id === abilityId)) {
        add('OVERRIDE_INVALID', `${role.displayName} has no ability "${abilityId}" to override.`, { roleId: role.id, abilityId });
        overridesOk = false;
      }
    }
    for (const base of profile.abilities) {
      const override = entry.overrides?.[base.id];
      if (!override) {
        abilities.push(base);
        continue;
      }
      if (!isLimit(override.usesPerGame ?? null) || !isLimit(override.usesPerPhase ?? null) || !isCount(override.cooldownNights ?? 0)) {
        add('ABILITY_LIMIT_INVALID', `${base.id}: charges and cooldowns must be whole numbers of 0 or more.`, { roleId: role.id, abilityId: base.id });
        overridesOk = false;
        continue;
      }
      const applied = applyOverride(base, override);
      if (Array.isArray(applied)) {
        for (const p of applied) add('OVERRIDE_INVALID', `${p.abilityId}: ${p.reason}.`, { roleId: role.id, abilityId: p.abilityId });
        overridesOk = false;
        continue;
      }
      if (applied.usesPerPhase !== null && applied.usesPerGame !== null && applied.usesPerPhase > applied.usesPerGame) {
        add('ABILITY_LIMIT_INVALID', `${base.id}: uses per ${base.timing === 'DAY' ? 'day' : 'night'} (${applied.usesPerPhase}) cannot exceed uses per game (${applied.usesPerGame}).`, { roleId: role.id, abilityId: base.id });
      }
      abilities.push(applied);
    }
    if (overridesOk && profile.chargePolicy) {
      for (const a of abilities) {
        const unlimited = a.usesPerGame === null;
        if ((profile.chargePolicy === 'UNLIMITED') !== unlimited) {
          add('DOCTOR_PROFILE_MIX', `${profile.id} keeps ${profile.chargePolicy === 'UNLIMITED' ? 'unlimited' : 'limited'} charges. Use the other profile instead of overriding ${a.id}.`, { roleId: role.id, abilityId: a.id, decisionIds: ['OD-02'] });
        }
      }
    }

    seated.push({ resolved: { entry, role, profile, faction, victory: seatedVictory, abilities }, count: entry.count, status });
  }

  if (selected !== n) {
    add('ROLE_COUNT_MISMATCH', `Roles fill ${selected} seats but the game has ${n} players.`);
  }

  // Composition
  const seatsWhere = (pred: (s: (typeof seated)[number]) => boolean) => seated.filter(pred).reduce((sum, s) => sum + s.count, 0);
  const hasAbility = (s: (typeof seated)[number], pred: (a: AbilityDefinition) => boolean) => s.resolved.abilities.some(pred);

  const factions = Object.fromEntries(FACTIONS.map((f) => [f, seatsWhere((s) => s.resolved.faction === f)])) as Record<Faction, number>;
  const startingPack = factions.WOLF_PACK;
  const { wolfCap } = config.teams;
  const infection = config.infection;

  const infectionSources = seatsWhere((s) => hasAbility(s, (a) => a.capability === 'INFECT'));
  if (infectionSources > 1) add('MULTIPLE_ALPHAS', `Only one Alpha Wolf may be seated, not ${infectionSources}.`, { roleId: 'alpha_wolf' });
  for (const s of seated) {
    if (s.resolved.role.uniqueInGame && s.count > 1 && !hasAbility(s, (a) => a.capability === 'INFECT')) {
      add('MULTIPLE_ALPHAS', `${s.resolved.role.displayName} can be seated only once.`, { roleId: s.resolved.role.id });
    }
  }
  if (infection.enabled && infectionSources === 0) add('INFECTION_WITHOUT_ALPHA', 'Infection is on but no Alpha Wolf is seated.', { roleId: 'alpha_wolf' });

  if (!isCount(wolfCap) || startingPack > wolfCap) {
    add('WOLF_CAP', `The wolf cap (${wolfCap}) is below the starting pack (${startingPack}).`);
  }
  if (infection.enabled) {
    const aboveLimits = wolfCap !== INFECTION_EDITION_LIMITS.wolfCap || infection.maxSuccesses !== INFECTION_EDITION_LIMITS.maxSuccesses;
    if (config.mode === 'INFECTION' && aboveLimits) {
      add('WOLF_CAP_ABOVE_MODE', `Infection Edition uses a wolf cap of ${INFECTION_EDITION_LIMITS.wolfCap} and ${INFECTION_EDITION_LIMITS.maxSuccesses} successful infections. This mode does not accept an override.`);
    } else if (
      (wolfCap > INFECTION_EDITION_LIMITS.wolfCap || infection.maxSuccesses > INFECTION_EDITION_LIMITS.maxSuccesses) &&
      config.rulesetAcknowledgments[WOLF_CAP_OVERRIDE_ACK] !== 'true'
    ) {
      add('WOLF_CAP_ABOVE_MODE', `A wolf cap above ${INFECTION_EDITION_LIMITS.wolfCap} or more than ${INFECTION_EDITION_LIMITS.maxSuccesses} infections needs the ${WOLF_CAP_OVERRIDE_ACK} acknowledgement.`);
    }
    if (!isCount(infection.maxSuccesses) || !isCount(infection.attemptsPerNight) || infection.attemptsPerNight < 1) {
      add('ABILITY_LIMIT_INVALID', 'Infection needs at least 1 attempt per night and a whole-number success cap.');
    }
  }

  for (const [faction, target] of Object.entries(config.teams.targets ?? {})) {
    if (target !== undefined && factions[faction as Faction] !== target) {
      add('TEAM_TARGET_MISMATCH', `${faction} is set to ${target} seats but the roles give ${factions[faction as Faction]}.`);
    }
  }

  const doctors = seatsWhere((s) => hasAbility(s, (a) => a.id === 'doctor_save'));
  if (doctors > 1) add('DUPLICATE_ACTIVE_HEAL', `Only one Doctor may hold an active save at start, not ${doctors}.`, { roleId: 'doctor' });

  for (const s of seated) {
    const needed = s.resolved.role.requiresRoleId;
    if (needed && seatsWhere((t) => t.resolved.role.id === needed) === 0) {
      add('PACK_DEPENDENCY', `${s.resolved.role.displayName} needs a ${catalog.byId.get(needed)?.displayName ?? needed} at the table.`, { roleId: s.resolved.role.id });
    }
    for (const a of s.resolved.abilities) {
      const weight = a.config['weight'];
      if (a.capability === 'VOTE_MODIFIER' && typeof weight === 'number' && weight >= n / 2) {
        add('VOTE_WEIGHT_DOMINANT', `${s.resolved.role.displayName} vote weight ${weight} is at least half of ${n} players.`, { roleId: s.resolved.role.id, abilityId: a.id });
      } else if (a.capability === 'VOTE_MODIFIER' && typeof weight === 'number' && weight >= 3) {
        add('VOTE_WEIGHT_HIGH', `${s.resolved.role.displayName} vote weight ${weight} is 3 or more (OD-69).`, { roleId: s.resolved.role.id, abilityId: a.id, decisionIds: ['OD-69'] });
      }
    }
  }

  // BUG-01: with no wolf-aligned seat, the Village has already won before the first night.
  if (selected > 0 && seatsWhere((s) => isWolfAligned(s.resolved.role, s.resolved.faction)) === 0) {
    add('NO_WOLVES', 'The game needs at least one wolf. Add a Pack Wolf, an Alpha Wolf, or a Lone Wolf.');
  }

  const repeatingKill = seated.some((s) => hasAbility(s, (a) => a.capability === 'KILL' && a.usesPerGame === null));
  if (!config.voting.enabled && !repeatingKill && !infection.enabled) {
    add('NO_TERMINAL_PATH', 'With voting off, the game needs a repeating kill or infection to be able to end.');
  }

  if (infection.blockedByGuard) add('CONTRADICTION', 'Guard protection does not stop infection. That rule is confirmed and cannot be turned off.');
  if (infection.blockedByDoctor) add('CONTRADICTION', 'A Doctor save stops the wolf kill only, not infection. That rule is confirmed.');
  if (config.allowHostAdjudication) add('CONTRADICTION', 'Host adjudication is not available. The host paces phases and cannot choose outcomes (OD-54).', { decisionIds: ['OD-54'] });

  // Infection Edition is locked to its confirmed setup.
  if (config.mode === 'INFECTION') {
    const lock = (what: string) => add('MODE_RULE_LOCKED', `Infection Edition: ${what}`);
    const key = (e: { roleId: string; count: number; abilityProfile?: string }) => `${e.roleId}:${e.count}:${e.abilityProfile ?? ''}`;
    const actual = config.roles.filter((e) => e.count > 0).map(key).sort();
    const expected = INFECTION_CORE_ROLES.map(key).sort();
    if (actual.join() !== expected.join()) lock('the role list is fixed to 1 Alpha Wolf, 2 Seekers, 1 Guard, 1 Doctor, 1 Witch, and 14 Villagers.');
    if (config.roles.some((e) => e.overrides && Object.keys(e.overrides).length > 0)) lock('ability limits cannot be overridden.');
    if (!infection.enabled) lock('infection must be on.');
    if (infection.eligibility !== 'VILLAGE_ONLY') lock('infection targets Village players only.');
    if (infection.announcement !== 'SILENT') lock('infection is silent (OD-44).');
    if (!config.wolves.friendlyFire) lock('friendly fire is on.');
    if (config.wolves.knowsTeammates) lock('wolves do not know each other.');
    if (config.night.profile !== 'infection-v1') lock('the night profile is infection-v1.');
  }

  // Ultimate 20 is locked to its own roster. Infection Edition's block above is unchanged.
  if (config.mode === 'ULTIMATE_20') {
    const lock = (what: string) => add('MODE_RULE_LOCKED', `Ultimate 20: ${what}`);
    const key = (e: { roleId: string; count: number; abilityProfile?: string; faction?: string }) =>
      `${e.roleId}:${e.count}:${e.abilityProfile ?? ''}:${e.faction ?? ''}`;
    const actual = config.roles.filter((e) => e.count > 0).map(key).sort();
    const expected = ULTIMATE_20_ROLES.map(key).sort();
    if (actual.join() !== expected.join()) lock('the role list, profiles, and factions are fixed.');
    if (config.roles.some((e) => e.overrides && Object.keys(e.overrides).length > 0)) lock('ability limits cannot be overridden.');
    if (!infection.enabled) lock('infection must be on.');
    if (infection.maxSuccesses !== 4 || config.teams.wolfCap !== 5) lock('infection allows 4 successes and the wolf cap is 5.');
    if (infection.eligibility !== 'VILLAGE_ONLY') lock('infection targets Village players only.');
    if (!infection.requiresSurvival) lock('infection requires survival.');
    if (infection.announcement !== 'SILENT') lock('infection is silent.');
    if (config.wolves.killAggregation !== 'ALPHA_PRIORITY') lock("the Alpha Wolf's target is the kill.");
    if (config.wolves.friendlyFire) lock('friendly fire is off.');
    if (config.wolves.knowsTeammates) lock('wolves do not know each other.');
    if (config.night.profile !== 'ultimate-v1') lock('the night profile is ultimate-v1.');
    if (config.night.toggles.protectionBlocksPoison) lock('protection does not stop poison.');
  }

  // Blocking decisions
  for (const decision of BLOCKING_DECISIONS) {
    if (!decision.appliesTo(config, catalog)) continue;
    const choice = decision.choiceOf(config, catalog);
    const ack = config.rulesetAcknowledgments[decision.id];
    if (ack === undefined) {
      add('DECISION_UNSET', `${decision.id} (${decision.title}) needs an acknowledgement before start.`, { decisionIds: [decision.id] });
    } else if (choice !== null && ack !== choice) {
      add('DECISION_MISMATCH', `${decision.id} was acknowledged as ${ack}, but the configuration uses ${choice}.`, { decisionIds: [decision.id] });
    }
    if (config.mode === 'INFECTION' && decision.decided && choice !== null && choice !== decision.decided) {
      add('MODE_RULE_LOCKED', `Infection Edition: ${decision.id} is decided as ${decision.decided}, not ${choice}.`, { decisionIds: [decision.id] });
    }
  }

  // Warnings
  if (n > 0) {
    const ratio = startingPack / n;
    if (ratio > 0.3) add('WOLF_RATIO_HIGH', `${startingPack} starting wolves of ${n} players is above 30 percent.`);
    if (startingPack > 0 && ratio < 0.1 && !infection.enabled) add('WOLF_RATIO_LOW', `${startingPack} starting wolves of ${n} players is below 10 percent, with no infection to grow the pack.`);
  }
  if (infection.enabled && wolfCap >= Math.ceil(n / 2)) {
    add('INFECTION_CAN_REACH_PARITY', `A wolf cap of ${wolfCap} lets infection alone reach parity with ${n} players.`);
  }
  const info = seatsWhere((s) => s.resolved.role.category === 'INVESTIGATION');
  const infoLimit = Math.max(2, Math.floor(n / 8));
  if (info > infoLimit) add('INFO_ROLE_DENSITY', `${info} information roles is above the suggested ${infoLimit} for ${n} players.`);
  const protection = seatsWhere((s) => s.resolved.role.category === 'PROTECTION');
  if (n <= 15 && protection > 3) add('PROTECTION_DENSITY', `${protection} protection roles is above 3 for ${n} players.`);
  const neutrals = factions.NEUTRAL + factions.INDEPENDENT;
  if (neutrals > Math.floor(n / 5)) add('NEUTRAL_DENSITY', `${neutrals} Neutral and Independent seats is above ${Math.floor(n / 5)} for ${n} players.`);

  const unconfirmed = seated.filter((s) => s.status === 'RECOMMENDED');
  const packStatus = PACK_STATUS[config.rolePackId];
  if (unconfirmed.length > 0 || (packStatus && packStatus !== 'CONFIRMED' && packStatus !== 'TEMPLATE')) {
    const decisionIds = unique(unconfirmed.flatMap((s) => [...s.resolved.role.decisionIds, ...s.resolved.profile.decisionIds]));
    const names = unique(unconfirmed.map((s) => s.resolved.role.displayName));
    add('UNCONFIRMED_PRESET', [
      packStatus === 'RECONSTRUCTION' ? 'This preset is a reconstruction for playtesting, not a confirmed setup.' : null,
      names.length > 0 ? `It uses recommended rules that are not confirmed yet: ${names.join(', ')}.` : null,
    ].filter(Boolean).join(' '), { decisionIds });
  }

  if (seated.some((s) => hasAbility(s, (a) => a.capability === 'HEAL' && a.config['mode'] === 'INFORMED_VETO' && a.usesPerGame === null))) {
    add('INFORMED_DOCTOR', 'The Doctor is told the wolf target and has unlimited saves, so night kills can stall while the Doctor is alive.', { roleId: 'doctor', decisionIds: ['OD-02'] });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
    infos: issues.filter((i) => i.severity === 'info'),
    summary: {
      playerCount: n,
      selectedSeats: selected,
      remainingSeats: n - selected,
      factions,
      startingPack,
      wolfCap,
      infectionSuccesses: infection.enabled ? infection.maxSuccesses : null,
    },
  };
}
