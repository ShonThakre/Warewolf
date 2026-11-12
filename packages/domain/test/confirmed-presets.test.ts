import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, getPack, validateConfiguration } from '../src/index.js';

/**
 * 12 November 2026: the product owner decided every open rule (OD-05 to
 * OD-84). Every role is CONFIRMED except the four with no power (Hermit,
 * Priest, Confuser, Bard), so no preset carries the "recommended rules"
 * warning. The Pack 2 reconstruction stays marked as one (OD-61).
 */

const CONFIRMED_PRESETS = ['infection-core', 'classic-10', 'investigation-15', 'protection-15', 'chaos-15', 'expanded-24', 'expanded-30', 'ultimate-20'];

describe('confirmed presets', () => {
  it.each(CONFIRMED_PRESETS)('%s validates with no errors and no unconfirmed-rules warning', (id) => {
    const pack = getPack(id)!;
    expect(pack.status).toBe('CONFIRMED');
    const result = validateConfiguration(pack.config);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.code)).not.toContain('UNCONFIRMED_PRESET');
  });

  it('keeps the reconstruction marked as one', () => {
    expect(getPack('expanded-infection-20')!.status).toBe('RECONSTRUCTION');
    const warning = validateConfiguration(getPack('expanded-infection-20')!.config).warnings.find((w) => w.code === 'UNCONFIRMED_PRESET');
    expect(warning?.message).toContain('reconstruction');
  });

  it('leaves no role recommended, and keeps the four undefined roles unresolved', () => {
    expect(DEFAULT_CATALOG.roles.filter((r) => r.implementationStatus === 'RECOMMENDED').map((r) => r.id)).toEqual([]);
    for (const id of ['hermit', 'priest', 'confuser', 'bard']) expect(DEFAULT_CATALOG.byId.get(id)?.implementationStatus).toBe('UNRESOLVED');
  });
});
