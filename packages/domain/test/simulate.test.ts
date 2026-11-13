import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CATALOG } from '../src/catalog/catalog.js';
import { simulate } from '../src/simulate/run.js';
import type { SeatProjection } from '../src/simulate/view.js';
import { describe, expect, it } from 'vitest';

const roleIds = new Set(DEFAULT_CATALOG.roles.map((role) => role.id));

function exactRoleIds(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    if (roleIds.has(value)) found.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) exactRoleIds(item, found);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) exactRoleIds(item, found);
  }
}

/** The seat's own role, plus any role a Seeker was told by its once-per-game role card. */
function toldRoleIds(view: SeatProjection): Set<string> {
  const told = new Set([view.roleId]);
  for (const result of view.ownResults) if (result.kind === 'ROLE_ID' && typeof result.value === 'string') told.add(result.value);
  return told;
}

describe('seeded simulator (WW-1401)', () => {
  it('gives each bot only its own role', () => {
    const views: SeatProjection[] = [];
    simulate({ games: 1, seed: 7, policyId: 'random-legal', onView: (view) => views.push(structuredClone(view)) });
    expect(views.length).toBeGreaterThan(20);
    for (const view of views) {
      const found = new Set<string>();
      exactRoleIds(view, found);
      expect(found.has(view.roleId)).toBe(true);
      expect([...found].filter((id) => !toldRoleIds(view).has(id))).toEqual([]);
      if (view.window !== 'KILL') expect(view.killCandidates).toBeNull();
      const toldTheTarget = view.abilities.some((ability) => ability.config.target.kind === 'FINAL_WOLF_TARGET');
      if (!toldTheTarget) expect(view.finalWolfTarget).toBeUndefined();
    }
    const hostKill = views.find((view) => view.window === 'KILL');
    expect(hostKill?.isHost).toBe(true);
    expect(hostKill?.killCandidates?.every((id) => viewHasNoRole(id))).toBe(true);
  });

  it('finishes 1,000 Infection games and writes the report', () => {
    const report = simulate({ games: 1000, seed: 1, policyId: 'random-legal' });
    expect(report).toMatchObject({ presetId: 'infection-core', policyId: 'random-legal', seed: 1, games: 1000, finished: 1000 });
    expect(report.finish.VILLAGE + report.finish.WOLF_PACK + report.finish.draw + report.finish.other).toBe(1000);
    expect(report.rounds.mean).toBeGreaterThan(0);
    expect(report.rounds.median).toBeGreaterThan(0);
    expect(report.doctorNegatedFraction).toBeGreaterThanOrEqual(0);
    expect(report.doctorNegatedFraction).toBeLessThanOrEqual(1);
    expect(report.survivalByStartingRole['alpha_wolf']).toBeGreaterThanOrEqual(0);
    const path = join(tmpdir(), 'warewolf-infection-1000.json');
    writeFileSync(path, `${JSON.stringify(report)}\n`);
    expect(JSON.parse(JSON.stringify(report)).note).toMatch(/Not a human win rate/);
  }, 180_000);

  it('saving-doctor spends the save on every attack it is told of, and stays within the seat view', () => {
    const views: SeatProjection[] = [];
    const saving = simulate({ games: 300, seed: 3, policyId: 'saving-doctor', onView: (view) => views.push(view) });
    const random = simulate({ games: 300, seed: 3, policyId: 'random-legal' });
    expect(saving.finished).toBe(300);
    // An informed Doctor who never declines negates far more than a random one.
    expect(saving.doctorNegatedFraction).toBeGreaterThan(random.doctorNegatedFraction + 0.2);
    for (const view of views) {
      const found = new Set<string>();
      exactRoleIds(view, found);
      expect(found.has(view.roleId)).toBe(true);
      expect([...found].filter((id) => !toldRoleIds(view).has(id))).toEqual([]);
    }
  }, 180_000);
});

function viewHasNoRole(id: string): boolean {
  return !roleIds.has(id);
}
