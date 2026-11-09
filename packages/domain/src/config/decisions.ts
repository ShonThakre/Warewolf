import type { RoleCatalog } from '../catalog/catalog.js';
import type { GameConfiguration } from './types.js';

/**
 * Blocking open decisions that a configuration must acknowledge before start.
 * See docs/werewolf/open-decisions.md. A decision the product owner has made
 * is binding for Infection Edition. Other modes may choose another option,
 * but the host must still acknowledge what the configuration does.
 */
export interface BlockingDecision {
  readonly id: string;
  readonly title: string;
  readonly options: readonly string[];
  /** The product owner's decision, binding in Infection Edition. Null while open. */
  readonly decided: string | null;
  readonly decidedOn: string | null;
  /** Which configurations must acknowledge it. */
  readonly appliesTo: (config: GameConfiguration, catalog: RoleCatalog) => boolean;
  /** The option this configuration actually implements, or null when it cannot be read. */
  readonly choiceOf: (config: GameConfiguration, catalog: RoleCatalog) => string | null;
}

const seats = (config: GameConfiguration, roleId: string) =>
  config.roles.filter((e) => e.roleId === roleId).reduce((n, e) => n + e.count, 0);

function doctorMode(config: GameConfiguration, catalog: RoleCatalog): string | null {
  const entry = config.roles.find((e) => e.roleId === 'doctor' && e.count > 0);
  const role = catalog.byId.get('doctor');
  if (!entry || !role) return null;
  const profile = role.profiles[entry.abilityProfile ?? role.defaultProfileId];
  const save = profile?.abilities.find((a) => a.id === 'doctor_save');
  if (!save) return null;
  const mode = entry.overrides?.['doctor_save']?.config?.['mode'] ?? save.config['mode'];
  return typeof mode === 'string' ? mode : null;
}

export const BLOCKING_DECISIONS: readonly BlockingDecision[] = [
  {
    id: 'OD-01',
    title: 'How wolf submissions become one final kill target',
    options: ['HOST_SELECT_AMONG_SUBMISSIONS', 'MAJORITY', 'ALPHA_PRIORITY'],
    decided: 'HOST_SELECT_AMONG_SUBMISSIONS',
    decidedOn: '2026-11-09',
    appliesTo: (config) => config.mode === 'INFECTION',
    choiceOf: (config) => config.wolves.killAggregation,
  },
  {
    id: 'OD-02',
    title: 'Whether the Doctor is told the final target before saving',
    options: ['INFORMED_VETO', 'BLIND_TARGET'],
    decided: 'INFORMED_VETO',
    decidedOn: '2026-11-09',
    appliesTo: (config) => config.mode === 'INFECTION' && seats(config, 'doctor') > 0,
    choiceOf: doctorMode,
  },
  {
    id: 'OD-03',
    title: 'Infection of a player who also dies that night',
    // Option 3 of the document, "infection cancels the death", contradicts wolf-kill resolution and is not offered.
    options: ['SURVIVAL_REQUIRED', 'CONVERT_BEFORE_DEATH'],
    decided: 'SURVIVAL_REQUIRED',
    decidedOn: '2026-11-09',
    appliesTo: (config) => config.infection.enabled,
    choiceOf: (config) => (config.infection.requiresSurvival ? 'SURVIVAL_REQUIRED' : 'CONVERT_BEFORE_DEATH'),
  },
];

/** The acknowledgements a configuration needs, with the value each must carry. */
export function requiredAcknowledgments(config: GameConfiguration, catalog: RoleCatalog): Record<string, string | null> {
  return Object.fromEntries(
    BLOCKING_DECISIONS.filter((d) => d.appliesTo(config, catalog)).map((d) => [d.id, d.choiceOf(config, catalog)]),
  );
}
