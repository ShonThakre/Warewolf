import type { GameEvent } from '@warewolf/contracts';
import type { Seat } from './driver.js';
import type { PhaseContext } from './play.js';

/**
 * Checks that hold in every phase of every game, read from the players'
 * side of the API. They catch a leak or an illegal step whatever the
 * scenario is about.
 */

export interface Violation {
  readonly round: number;
  readonly phase: string;
  readonly rule: string;
  readonly detail: string;
}

/** The legal next phases (packages/domain/src/phase/machine.ts). CANCELLED and FINISHED are reachable from any active phase. */
const NEXT: Readonly<Record<string, readonly string[]>> = {
  LOBBY: ['ROLE_REVEAL'],
  ROLE_REVEAL: ['NIGHT_SUBMIT'],
  NIGHT_SUBMIT: ['NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE'],
  NIGHT_HOST_CONFIRM: ['NIGHT_REACTION', 'DAY_ANNOUNCE'],
  NIGHT_REACTION: ['DAY_ANNOUNCE'],
  DAY_ANNOUNCE: ['DAY_DISCUSSION'],
  DAY_DISCUSSION: ['VOTING', 'NIGHT_SUBMIT'],
  VOTING: ['REVOTE', 'NIGHT_SUBMIT'],
  REVOTE: ['NIGHT_SUBMIT'],
};

export function isLegalStep(from: string, to: string): boolean {
  if (to === 'FINISHED' || to === 'CANCELLED') return true;
  return NEXT[from]?.includes(to) ?? false;
}

/** Keys that would carry a role or an alignment. None may appear in public state. */
const SECRET_KEYS = new Set(['roleId', 'originalRole', 'currentRole', 'originalRoleId', 'currentRoleId', 'faction', 'wolfAligned', 'profileId']);

export function secretKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => secretKeys(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => (SECRET_KEYS.has(k) ? [`${path}.${k}`] : secretKeys(v, `${path}.${k}`)));
  }
  return [];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** JSON paths of every id in `value` that is not in `allowed`. */
export function foreignIds(value: unknown, allowed: ReadonlySet<string>, path = '$'): string[] {
  if (typeof value === 'string') return [...value.matchAll(UUID)].some((m) => !allowed.has(m[0].toLowerCase())) ? [`${path}=${JSON.stringify(value)}`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => foreignIds(v, allowed, `${path}[${i}]`));
  // A copied Mimic ability's group is `mimic:<the Mimic's own copy action id>` (night/resolve.ts), not another seat's id.
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => (k === 'exclusiveGroup' ? [] : foreignIds(v, allowed, `${path}.${k}`)));
  return [];
}

/** Private event types and who may receive them, judged from the host roster. */
const PRIVATE_EVENT_RULES: Readonly<Record<string, (ctx: PhaseContext, playerId: string) => boolean>> = {
  INFECTION_OCCURRED: (ctx, id) => ctx.entry(id).wolfAligned,
  ROLE_CONVERTED: (ctx, id) => {
    const p = ctx.entry(id);
    return p.currentRoleId !== p.originalRoleId;
  },
};

export async function checkPhase(ctx: PhaseContext): Promise<Violation[]> {
  const out: Violation[] = [];
  const add = (rule: string, detail: string) => out.push({ round: ctx.state.roundNumber, phase: ctx.state.phase, rule, detail });
  const { driver, state, memo } = ctx;

  // 1. Phase steps follow the machine.
  const previous = memo.get('invariants.phase') as string | undefined;
  if (previous && previous !== state.phase && !isLegalStep(previous, state.phase)) add('legal-step', `${previous} -> ${state.phase}`);
  memo.set('invariants.phase', state.phase);

  // 2. Public state never carries a role, for the host or for a player.
  const player = driver.seats.find((s) => !s.isHost && s.playerId !== driver.host.playerId) ?? driver.host;
  for (const seat of [driver.host, player]) {
    const leaked = secretKeys(await driver.state(seat));
    if (leaked.length > 0) add('state-has-no-roles', `${seat.displayName}: ${leaked.join(', ')}`);
  }

  // 3. Results stay closed while the game runs.
  const results = await driver.resultsRaw(player);
  if (results.status !== 409) add('results-closed-while-active', `GET /results answered ${results.status}`);

  // 4. Each seat's own view names nobody else, apart from teammates the configuration shows.
  if (state.phase === 'DAY_ANNOUNCE' || state.phase === 'ROLE_REVEAL') {
    for (const seat of driver.seats) {
      const me = await driver.me(seat);
      const allowed = new Set([seat.playerId, driver.gameId, ...me.teammates.map((t) => t.playerId), ...me.abilities.map((a) => a.abilityInstanceId)]);
      const others = foreignIds(me, allowed);
      if (others.length > 0) add('me-is-private', `${seat.displayName} (${me.currentRole.id}) sees another seat's id at ${others.join(', ')}`);
      if (me.playerId !== seat.playerId) add('me-is-private', `${seat.displayName} got another seat's /me`);
    }
  }

  // 5. Events: a player never receives a host event, or a private event meant for someone else.
  for (const seat of driver.seats) {
    if (seat.playerId === driver.host.playerId) continue;
    const cursorKey = `invariants.seq.${seat.playerId}`;
    const events: GameEvent[] = await driver.events(seat, (memo.get(cursorKey) as number | undefined) ?? 0);
    if (events.length > 0) memo.set(cursorKey, events.at(-1)!.seq);
    for (const event of events) {
      if (event.audience === 'HOST') add('no-host-events-for-players', `${seat.displayName} received ${event.type}`);
      const rule = PRIVATE_EVENT_RULES[event.type];
      if (event.audience === 'PLAYER' && rule && !rule(ctx, seat.playerId)) add('private-events-reach-owner', `${seat.displayName} received ${event.type}`);
    }
  }

  return out;
}

/** Every private event one seat has received so far. */
export async function privateEvents(ctx: { driver: { events(seat: Seat, afterSeq?: number): Promise<GameEvent[]> } }, seat: Seat): Promise<GameEvent[]> {
  return (await ctx.driver.events(seat)).filter((e) => e.audience === 'PLAYER');
}
