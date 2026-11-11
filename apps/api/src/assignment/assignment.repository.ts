import { randomUUID } from 'node:crypto';
import type { DealtRole } from '@warewolf/domain';
import { asc, eq } from 'drizzle-orm';
import type { Database, Transaction } from '../db/database.js';
import {
  abilityInstances,
  roleAssignments,
  type AbilityInstanceRow,
  type NewAbilityInstanceRow,
  type NewRoleAssignmentRow,
  type RoleAssignmentRow,
} from '../db/schema.js';

/**
 * The only module that writes `role_assignments` and `ability_instances`
 * (WW-401). See docs/werewolf/data-model.md, "Ownership".
 *
 * What was dealt is history. There is no function here that updates an
 * `original_*` column, and `changeAssignment` drops those keys even if a
 * caller smuggles them past the type. A database trigger rejects the rest.
 */

type Executor = Database | Transaction;

/** The columns a conversion, an Assassin mark, or a victory may change. */
export const MUTABLE_ASSIGNMENT_FIELDS = [
  'currentRoleId',
  'currentProfileId',
  'currentFaction',
  'wolfAligned',
  'individualVictory',
  'publicReveal',
  'markTargetPlayerId',
] as const;

export type AssignmentChange = Partial<Pick<RoleAssignmentRow, (typeof MUTABLE_ASSIGNMENT_FIELDS)[number]>>;

export interface PlayerAssignment {
  readonly assignment: RoleAssignmentRow;
  readonly abilities: readonly AbilityInstanceRow[];
}

export interface GameAssignments {
  readonly assignments: readonly RoleAssignmentRow[];
  readonly abilities: readonly AbilityInstanceRow[];
}

/** Writes a dealt table inside the start transaction. Original and current fields start equal. */
export async function insertDeal(tx: Transaction, gameId: string, dealt: readonly DealtRole[]): Promise<void> {
  if (dealt.length === 0) return;

  const assignments: NewRoleAssignmentRow[] = dealt.map((d) => ({
    id: randomUUID(),
    gameId,
    playerId: d.playerId,
    originalRoleId: d.roleId,
    originalProfileId: d.profileId,
    originalFaction: d.faction,
    currentRoleId: d.roleId,
    currentProfileId: d.profileId,
    currentFaction: d.faction,
    wolfAligned: d.wolfAligned,
  }));
  await tx.insert(roleAssignments).values(assignments);

  const abilities: NewAbilityInstanceRow[] = dealt.flatMap((d, i) =>
    d.abilities.map((a) => ({
      gameId,
      playerId: d.playerId,
      assignmentId: assignments[i]!.id!,
      abilityId: a.abilityId,
      capability: a.definition.capability,
      handlerKey: a.definition.handlerKey,
      chargesRemaining: a.chargesRemaining,
      availableFromRound: a.availableFromRound,
      source: 'NATIVE' as const,
      config: a.definition,
    })),
  );
  if (abilities.length > 0) await tx.insert(abilityInstances).values(abilities);
}

/** Every assignment and ability in a game. Host projections only. */
export async function gameAssignments(db: Executor, gameId: string): Promise<GameAssignments> {
  const [assignments, abilities] = await Promise.all([
    db.select().from(roleAssignments).where(eq(roleAssignments.gameId, gameId)),
    db.select().from(abilityInstances).where(eq(abilityInstances.gameId, gameId)).orderBy(asc(abilityInstances.createdAt)),
  ]);
  return { assignments, abilities };
}

/** One player's assignment and abilities, or null before the deal. */
export async function playerAssignment(db: Executor, playerId: string): Promise<PlayerAssignment | null> {
  const [assignment] = await db.select().from(roleAssignments).where(eq(roleAssignments.playerId, playerId));
  if (!assignment) return null;
  const abilities = await db.select().from(abilityInstances).where(eq(abilityInstances.assignmentId, assignment.id));
  return { assignment, abilities };
}

/**
 * Changes the current side of an assignment. Only the keys in
 * `MUTABLE_ASSIGNMENT_FIELDS` are written; anything else is ignored.
 */
export async function changeAssignment(tx: Executor, assignmentId: string, change: AssignmentChange): Promise<void> {
  const set: Record<string, unknown> = {};
  for (const key of MUTABLE_ASSIGNMENT_FIELDS) {
    if (change[key] !== undefined) set[key] = change[key];
  }
  if (Object.keys(set).length === 0) return;
  await tx.update(roleAssignments).set(set as AssignmentChange).where(eq(roleAssignments.id, assignmentId));
}
