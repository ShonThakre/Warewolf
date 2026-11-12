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
  /** Ultimate 20 outcomes read from the stored resolver result (GAP-03). Absent for a night that had none. */
  readonly special?: SpecialOutcomes;
}

export interface SpecialOutcomes {
  readonly hints: readonly { readonly actionId: string; readonly actorId: string; readonly text: string }[];
  readonly silences: readonly { readonly actionId: string; readonly actorId: string; readonly targetId: string }[];
  readonly revivals: readonly { readonly actionId: string; readonly actorId: string; readonly targetId: string }[];
  readonly rewinds: readonly { readonly actionId: string; readonly actorId: string; readonly targetId: string; readonly removedActionIds: readonly string[] }[];
  readonly copies: readonly { readonly actionId: string; readonly actorId: string; readonly targetId: string; readonly abilityIds: readonly string[] }[];
  readonly chaosEvent: { readonly actorId: string; readonly kind: string; readonly playerIds: readonly string[]; readonly success: boolean | null } | null;
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

  if (source.special) drafts.push(...specialDrafts(round, source.special));

  return drafts;
}

/**
 * GAP-03. A Ghost hint is public text with no sender (ultimate-20-rules.md:
 * "an indirect secret hint the next day"). A Necromancer's return is public,
 * since the room sees the player back. A silence is told to its target only.
 * A rewind, a copy, and a Chaos event are told to the player who caused them.
 * The host gets every one with its actor.
 */
function specialDrafts(round: number, special: SpecialOutcomes): GameEventDraft[] {
  const drafts: GameEventDraft[] = [];
  const host = (type: string, key: string, payload: Record<string, unknown>): GameEventDraft => ({
    type,
    audience: 'HOST',
    recipientPlayerId: null,
    payload: { roundNumber: round, ...payload },
    dedupeKey: `night:${round}:${key}:host`,
  });
  const player = (type: string, key: string, recipient: string, payload: Record<string, unknown>): GameEventDraft => ({
    type,
    audience: 'PLAYER',
    recipientPlayerId: recipient,
    payload: { roundNumber: round, ...payload },
    dedupeKey: `night:${round}:${key}:player`,
  });

  for (const hint of [...special.hints].sort(byId)) {
    drafts.push({
      type: 'GHOST_HINT',
      audience: 'PUBLIC',
      recipientPlayerId: null,
      payload: { roundNumber: round, text: hint.text },
      dedupeKey: `night:${round}:hint:${hint.actionId}`,
    });
    drafts.push(host('GHOST_HINT', `hint:${hint.actionId}`, { text: hint.text, actorPlayerId: hint.actorId }));
  }
  for (const revival of [...special.revivals].sort(byId)) {
    drafts.push({
      type: 'PLAYER_RETURNED',
      audience: 'PUBLIC',
      recipientPlayerId: null,
      payload: { roundNumber: round, playerId: revival.targetId },
      dedupeKey: `night:${round}:returned:${revival.actionId}`,
    });
    drafts.push(host('PLAYER_RETURNED', `returned:${revival.actionId}`, { playerId: revival.targetId, actorPlayerId: revival.actorId }));
  }
  for (const silence of [...special.silences].sort(byId)) {
    drafts.push(player('SILENCED', `silence:${silence.actionId}`, silence.targetId, {}));
    drafts.push(host('SILENCED', `silence:${silence.actionId}`, { playerId: silence.targetId, actorPlayerId: silence.actorId }));
  }
  for (const rewind of [...special.rewinds].sort(byId)) {
    const cancelled = rewind.removedActionIds.length > 0;
    drafts.push(player('REWIND_RESULT', `rewind:${rewind.actionId}`, rewind.actorId, { targetPlayerIds: [rewind.targetId], cancelled }));
    drafts.push(host('REWIND_RESULT', `rewind:${rewind.actionId}`, { actorPlayerId: rewind.actorId, targetPlayerIds: [rewind.targetId], removedActionIds: [...rewind.removedActionIds] }));
  }
  for (const copy of [...special.copies].sort(byId)) {
    drafts.push(player('ABILITY_COPIED', `copy:${copy.actionId}`, copy.actorId, { targetPlayerIds: [copy.targetId], abilityIds: [...copy.abilityIds] }));
    drafts.push(host('ABILITY_COPIED', `copy:${copy.actionId}`, { actorPlayerId: copy.actorId, targetPlayerIds: [copy.targetId], abilityIds: [...copy.abilityIds] }));
  }
  if (special.chaosEvent) {
    const chaos = special.chaosEvent;
    drafts.push(player('CHAOS_EVENT', 'chaos', chaos.actorId, { kind: chaos.kind }));
    drafts.push(host('CHAOS_EVENT', 'chaos', { actorPlayerId: chaos.actorId, kind: chaos.kind, playerIds: [...chaos.playerIds], success: chaos.success }));
  }
  return drafts;
}
