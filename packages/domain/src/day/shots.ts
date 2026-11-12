import type { AttackType } from '../catalog/types.js';
import type { LifeStatus } from '../game.js';
import type { PlayerId } from '../snapshot.js';

/**
 * Day shots (WW-1003b, OD-29). The Sniper fires during day discussion; the
 * shots resolve when discussion closes, before voting opens. Pure: the API
 * gathers the inputs inside the close transaction and applies the deaths.
 */

/** One protection that resolved last night, with what it cancels. */
export interface NightProtection {
  /** The ability's `cancels` list, as frozen on the instance. */
  readonly cancels: readonly AttackType[];
  /** Its stored targets. Empty for a save aimed at the final wolf target. */
  readonly targetPlayerIds: readonly PlayerId[];
  /** True when the ability acts on the final wolf target (the informed Doctor). */
  readonly onFinalWolfTarget: boolean;
}

/**
 * Players covered against `attack` through the following day: every target
 * of a protection that resolved last night and cancels that attack. A save
 * on the final wolf target covers that player, when there was one.
 */
export function nightShields(protections: readonly NightProtection[], finalWolfTarget: PlayerId | null, attack: AttackType = 'SNIPER'): Set<PlayerId> {
  const shielded = new Set<PlayerId>();
  for (const protection of protections) {
    if (!protection.cancels.includes(attack)) continue;
    if (protection.onFinalWolfTarget) {
      if (finalWolfTarget) shielded.add(finalWolfTarget);
      continue;
    }
    for (const id of protection.targetPlayerIds) shielded.add(id);
  }
  return shielded;
}

export interface DayShot {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
}

/**
 * - `HIT`: the shot lands. The API still applies survival effects such as the Immortal.
 * - `SHIELDED`: a protection from last night stopped it. The shot is spent.
 * - `TARGET_DEAD`: the target had already died, for example to an earlier shot. The shot is spent.
 */
export type ShotOutcome = 'HIT' | 'SHIELDED' | 'TARGET_DEAD';

export interface ResolvedShot extends DayShot {
  readonly outcome: ShotOutcome;
}

/** Resolves shots in submission order. A shot that hits marks its target dead for the shots after it. */
export function resolveShots(shots: readonly DayShot[], life: ReadonlyMap<PlayerId, LifeStatus>, shielded: ReadonlySet<PlayerId>): ResolvedShot[] {
  const alive = new Set([...life].filter(([, status]) => status === 'ALIVE').map(([id]) => id));
  return shots.map((shot) => {
    if (!alive.has(shot.targetId)) return { ...shot, outcome: 'TARGET_DEAD' };
    if (shielded.has(shot.targetId)) return { ...shot, outcome: 'SHIELDED' };
    alive.delete(shot.targetId);
    return { ...shot, outcome: 'HIT' };
  });
}
