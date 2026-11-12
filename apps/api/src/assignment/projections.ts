import type { HostRoster, MyRole, OwnAbility, RoleRef, RosterEntry, Teammate } from '@warewolf/contracts';
import { DEFAULT_CATALOG, isVampireTeamRole, type GameConfiguration, type RoleCatalog } from '@warewolf/domain';
import type { AbilityInstanceRow, GamePlayerRow, GameRow, RoleAssignmentRow } from '../db/schema.js';

/**
 * Pure builders for the role projections (WW-403). They take rows and return
 * contract shapes. Inputs are already narrowed to what the audience may see:
 * the player builder never receives another player's assignment, only the
 * seats of teammates the configuration lets them know.
 */

/**
 * Classic Pack Wolves see each other when the configuration says so. Infection wolves never do (C-07).
 * A Vampire and a Servant see the living Vampire team. A pending mark does not.
 */
export function teammatesVisible(config: GameConfiguration, assignment: RoleAssignmentRow): boolean {
  if (isVampireTeamRole(assignment.currentRoleId)) return true;
  return config.wolves.knowsTeammates && assignment.currentFaction === 'WOLF_PACK';
}

function roleRef(roleId: string, profileId: string, faction: RoleRef['faction'], catalog: RoleCatalog): RoleRef {
  return { id: roleId, profileId, name: catalog.byId.get(roleId)?.displayName ?? roleId, faction };
}

/** Sorts abilities in the order their profiles list them, so the card reads the same every time. */
function byProfileOrder(assignment: RoleAssignmentRow, catalog: RoleCatalog) {
  const order = [
    ...(catalog.byId.get(assignment.currentRoleId)?.profiles[assignment.currentProfileId]?.abilities ?? []),
    ...(catalog.byId.get(assignment.originalRoleId)?.profiles[assignment.originalProfileId]?.abilities ?? []),
  ].map((a) => a.id);
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return (a: AbilityInstanceRow, b: AbilityInstanceRow) => rank(a.abilityId) - rank(b.abilityId) || a.abilityId.localeCompare(b.abilityId);
}

function ownAbility(row: AbilityInstanceRow): OwnAbility {
  const d = row.config;
  return {
    abilityInstanceId: row.id,
    abilityId: row.abilityId,
    capability: row.capability ?? null,
    timing: d.timing,
    status: row.status,
    usesRemaining: row.chargesRemaining,
    usesPerPhase: d.usesPerPhase,
    cooldownNights: d.cooldownNights,
    availableFromRound: row.availableFromRound,
    onlyRound: d.onlyRound,
    expiresRound: row.expiresRound,
    target: d.target,
    ...(typeof d.config['exclusiveGroup'] === 'string' ? { exclusiveGroup: d.config['exclusiveGroup'] } : {}),
  };
}

export interface OwnRoleInput {
  readonly game: Pick<GameRow, 'id'>;
  readonly you: Pick<GamePlayerRow, 'id' | 'displayName' | 'seatNumber' | 'lifeStatus'>;
  readonly assignment: RoleAssignmentRow;
  /** The caller's own ability rows only. */
  readonly abilities: readonly AbilityInstanceRow[];
  readonly teammatesVisible: boolean;
  /** Seats the caller may know as teammates. Empty unless `teammatesVisible`. */
  readonly teammates: readonly Pick<GamePlayerRow, 'id' | 'displayName' | 'seatNumber'>[];
}

/**
 * GET /games/:gameId/me. Revoked abilities are left out: after infection the
 * player sees what they can still do, not what they lost.
 */
export function ownRoleView(input: OwnRoleInput, catalog: RoleCatalog = DEFAULT_CATALOG): MyRole {
  const { assignment: a } = input;
  if (a.playerId !== input.you.id) throw new Error('ownRoleView: the assignment belongs to another player');
  const foreign = input.abilities.find((row) => row.assignmentId !== a.id);
  if (foreign) throw new Error('ownRoleView: an ability belongs to another assignment');

  const teammates: Teammate[] = input.teammatesVisible
    ? input.teammates
        .filter((t) => t.id !== input.you.id)
        .map((t) => ({ playerId: t.id, displayName: t.displayName, seatNumber: t.seatNumber }))
        .sort((x, y) => x.seatNumber - y.seatNumber)
    : [];

  return {
    gameId: input.game.id,
    playerId: input.you.id,
    displayName: input.you.displayName,
    seatNumber: input.you.seatNumber,
    lifeStatus: input.you.lifeStatus,
    originalRole: roleRef(a.originalRoleId, a.originalProfileId, a.originalFaction, catalog),
    currentRole: roleRef(a.currentRoleId, a.currentProfileId, a.currentFaction, catalog),
    abilities: input.abilities
      .filter((row) => row.status !== 'REVOKED')
      .sort(byProfileOrder(a, catalog))
      .map(ownAbility),
    teammatesVisible: input.teammatesVisible,
    teammates,
  };
}

export interface HostRosterInput {
  readonly game: Pick<GameRow, 'id' | 'phase' | 'roundNumber'>;
  readonly seats: readonly GamePlayerRow[];
  readonly assignments: readonly RoleAssignmentRow[];
  readonly abilities: readonly AbilityInstanceRow[];
}

/** GET /games/:gameId/host/roster. Every seat with its original and current role, in seat order. */
export function hostRosterView(input: HostRosterInput, catalog: RoleCatalog = DEFAULT_CATALOG): HostRoster {
  const byPlayer = new Map(input.assignments.map((a) => [a.playerId, a]));
  const players: RosterEntry[] = [...input.seats]
    .sort((x, y) => x.seatNumber - y.seatNumber)
    .map((seat) => {
      const a = byPlayer.get(seat.id);
      if (!a) throw new Error(`hostRosterView: seat ${seat.seatNumber} has no assignment`);
      return {
        playerId: seat.id,
        displayName: seat.displayName,
        seatNumber: seat.seatNumber,
        avatarId: seat.avatarId,
        isHost: seat.isHost,
        lifeStatus: seat.lifeStatus,
        originalRoleId: a.originalRoleId,
        originalProfileId: a.originalProfileId,
        originalFaction: a.originalFaction,
        currentRoleId: a.currentRoleId,
        currentProfileId: a.currentProfileId,
        currentFaction: a.currentFaction,
        wolfAligned: a.wolfAligned,
        abilities: input.abilities
          .filter((row) => row.assignmentId === a.id)
          .sort(byProfileOrder(a, catalog))
          .map((row) => ({
            abilityInstanceId: row.id,
            abilityId: row.abilityId,
            capability: row.capability ?? null,
            status: row.status,
            usesRemaining: row.chargesRemaining,
          })),
      };
    });
  return { gameId: input.game.id, phase: input.game.phase, roundNumber: input.game.roundNumber, players };
}
