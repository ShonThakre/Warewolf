import type { GameMode } from '../game.js';

/** Player bounds per mode. See implementation-plan.md, section 4. */
export const MODE_BOUNDS: Readonly<Record<GameMode, { readonly min: number; readonly max: number }>> = {
  INFECTION: { min: 20, max: 20 },
  CLASSIC: { min: 6, max: 20 },
  EXPANDED: { min: 10, max: 30 },
  CUSTOM: { min: 6, max: 30 },
  ULTIMATE_20: { min: 20, max: 20 },
};

/** Infection Edition's confirmed limits: 4 successful infections, pack of at most 5 including the Alpha. */
export const INFECTION_EDITION_LIMITS = { maxSuccesses: 4, wolfCap: 5 } as const;

/**
 * Acknowledgement a Custom or Expanded host sends to raise the wolf cap or
 * infection successes above Infection Edition's limits. Infection Edition
 * itself never accepts it.
 */
export const WOLF_CAP_OVERRIDE_ACK = 'WOLF_CAP_OVERRIDE';
