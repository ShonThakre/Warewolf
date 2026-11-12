/**
 * Private result rows for one committed night (WW-804). Built from the rows
 * the night already stored, so a payload never contains a fact that was not
 * written. The player copy and the host copy are separate objects.
 */

export type EventAudience = 'PUBLIC' | 'HOST' | 'PLAYER';

export interface GameEventDraft {
  readonly type: string;
  readonly audience: EventAudience;
  readonly recipientPlayerId: string | null;
  readonly payload: Record<string, unknown>;
  readonly dedupeKey: string;
}

export interface NightEventSource {
  readonly round: number;
  readonly investigations: readonly {
    readonly actionId: string;
    readonly actorPlayerId: string;
    readonly abilityId: string;
    readonly kind: string;
    readonly targetPlayerIds: readonly string[];
    readonly result: Record<string, unknown>;
  }[];
  readonly infections: readonly {
    readonly actionId: string;
    readonly sourcePlayerId: string;
    readonly targetPlayerId: string;
    readonly outcome: string;
    /** The role the target holds after a successful infection. Null on a failure. */
    readonly roleId: string | null;
  }[];
  readonly conversions: readonly {
    readonly playerId: string;
    readonly toRoleId: string;
    readonly reason: string;
    readonly revokedAbilityIds: readonly string[];
    /** Living Vampire, when this conversion is a promotion. Absent for every other reason. */
    readonly vampirePlayerId?: string | null;
    /** Living Vampire-team members, including the new Servant. */
    readonly teamPlayerIds?: readonly string[];
  }[];
  readonly eliminations: readonly {
    readonly playerId: string;
    readonly seatNumber: number;
    readonly roleAtDeath: string;
    readonly revealedPublicly: boolean;
  }[];
  readonly blocks: readonly {
    readonly actionId: string;
    readonly actorId: string;
    readonly targetId: string;
    readonly informTarget: boolean;
    readonly cancelledActionIds: readonly string[];
  }[];
}

const byId = (a: { readonly actionId?: string; readonly playerId?: string }, b: { readonly actionId?: string; readonly playerId?: string }) =>
  (a.actionId ?? a.playerId ?? '').localeCompare(b.actionId ?? b.playerId ?? '');

/**
 * Investigation results go to the actor and the host. A successful infection
 * and a role conversion go to that player and the host, and the player copy
 * has no source. Deaths are public, with a role id only when the night
 * reveals it. A block is told to its target only when `informTarget` is set,
 * and that copy does not name the blocker.
 */
export function nightEventDrafts(source: NightEventSource): GameEventDraft[] {
  const round = source.round;
  const drafts: GameEventDraft[] = [];

  for (const row of [...source.investigations].sort(byId)) {
    const fact = {
      roundNumber: round,
      actionId: row.actionId,
      abilityId: row.abilityId,
      kind: row.kind,
      targetPlayerIds: [...row.targetPlayerIds],
      result: row.result,
    };
    drafts.push({
      type: 'INVESTIGATION_RESULT',
      audience: 'PLAYER',
      recipientPlayerId: row.actorPlayerId,
      payload: fact,
      dedupeKey: `night:${round}:investigation:${row.actionId}:player`,
    });
    drafts.push({
      type: 'INVESTIGATION_RESULT',
      audience: 'HOST',
      recipientPlayerId: null,
      payload: { ...fact, actorPlayerId: row.actorPlayerId },
      dedupeKey: `night:${round}:investigation:${row.actionId}:host`,
    });
  }

  for (const row of [...source.infections].sort(byId)) {
    if (row.outcome !== 'SUCCESS' || !row.roleId) continue;
    const player = { roundNumber: round, actionId: row.actionId, roleId: row.roleId };
    drafts.push({
      type: 'INFECTION_OCCURRED',
      audience: 'PLAYER',
      recipientPlayerId: row.targetPlayerId,
      payload: player,
      dedupeKey: `night:${round}:infection:${row.actionId}:player`,
    });
    drafts.push({
      type: 'INFECTION_OCCURRED',
      audience: 'HOST',
      recipientPlayerId: null,
      payload: { ...player, sourcePlayerId: row.sourcePlayerId, targetPlayerId: row.targetPlayerId },
      dedupeKey: `night:${round}:infection:${row.actionId}:host`,
    });
  }

  for (const row of [...source.conversions].sort((a, b) => a.playerId.localeCompare(b.playerId))) {
    const revokedAbilityIds = [...row.revokedAbilityIds].sort();
    const team = row.reason === 'VAMPIRE'
      ? { vampirePlayerId: row.vampirePlayerId ?? null, teamPlayerIds: [...(row.teamPlayerIds ?? [])].sort() }
      : null;
    drafts.push({
      type: 'ROLE_CONVERTED',
      audience: 'PLAYER',
      recipientPlayerId: row.playerId,
      payload: { roundNumber: round, roleId: row.toRoleId, revokedAbilityIds, ...(team ?? {}) },
      dedupeKey: `night:${round}:conversion:${row.playerId}:player`,
    });
    drafts.push({
      type: 'ROLE_CONVERTED',
      audience: 'HOST',
      recipientPlayerId: null,
      payload: { roundNumber: round, playerId: row.playerId, roleId: row.toRoleId, reason: row.reason, revokedAbilityIds, ...(team ?? {}) },
      dedupeKey: `night:${round}:conversion:${row.playerId}:host`,
    });
    if (!team) continue;
    const notice = { roundNumber: round, servantPlayerId: row.playerId, vampirePlayerId: team.vampirePlayerId, teamPlayerIds: team.teamPlayerIds };
    for (const memberId of team.teamPlayerIds) {
      if (memberId === row.playerId) continue;
      drafts.push({
        type: 'VAMPIRE_TEAM_JOIN',
        audience: 'PLAYER',
        recipientPlayerId: memberId,
        payload: notice,
        dedupeKey: `night:${round}:vampire-team:${row.playerId}:${memberId}`,
      });
    }
    drafts.push({
      type: 'VAMPIRE_TEAM_JOIN',
      audience: 'HOST',
      recipientPlayerId: null,
      payload: notice,
      dedupeKey: `night:${round}:vampire-team:${row.playerId}:host`,
    });
  }

  for (const row of [...source.eliminations].sort((a, b) => a.playerId.localeCompare(b.playerId))) {
    drafts.push({
      type: 'PLAYER_ELIMINATED',
      audience: 'PUBLIC',
      recipientPlayerId: null,
      payload: {
        roundNumber: round,
        playerId: row.playerId,
        seatNumber: row.seatNumber,
        roleId: row.revealedPublicly ? row.roleAtDeath : null,
      },
      dedupeKey: `night:${round}:eliminated:${row.playerId}`,
    });
  }

  for (const row of [...source.blocks].sort(byId)) {
    if (row.informTarget) {
      drafts.push({
        type: 'ACTION_BLOCKED',
        audience: 'PLAYER',
        recipientPlayerId: row.targetId,
        payload: { roundNumber: round },
        dedupeKey: `night:${round}:block:${row.actionId}:player`,
      });
    }
    drafts.push({
      type: 'ACTION_BLOCKED',
      audience: 'HOST',
      recipientPlayerId: null,
      payload: {
        roundNumber: round,
        actorId: row.actorId,
        targetId: row.targetId,
        cancelledActionIds: [...row.cancelledActionIds],
      },
      dedupeKey: `night:${round}:block:${row.actionId}:host`,
    });
  }

  return drafts;
}
