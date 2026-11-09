/**
 * Factions are teams, not roles. A seated player stores an original and a
 * current faction separately from their original and current role.
 * See docs/werewolf/role-catalog.md, "Factions".
 */
export const FACTIONS = ['VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT'] as const;
export type Faction = (typeof FACTIONS)[number];

/** Coarse fact some investigation roles learn. Derived from `wolfAligned`. */
export const ALIGNMENT_REPORTS = ['WOLF', 'NON_WOLF'] as const;
export type AlignmentReport = (typeof ALIGNMENT_REPORTS)[number];
