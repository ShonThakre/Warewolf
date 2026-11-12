import type { RosterEntry } from '@warewolf/contracts';
import type { Choice } from './driver.js';
import type { AbilityView, PhaseContext, Policy } from './play.js';

/**
 * Scripted policies. Each one aims for a known ending so the suite can
 * assert the winner. They read the host roster, which a real player cannot;
 * that is fine for a test driver and is never how the simulator's bots play.
 */

const bySeat = (a: RosterEntry, b: RosterEntry) => a.seatNumber - b.seatNumber;
const first = (ids: readonly string[], prefer: readonly RosterEntry[]) => prefer.find((p) => ids.includes(p.playerId))?.playerId;

/** Nobody acts, the host picks no kill, everyone abstains. Useful for lobby, reload, and cancel checks. */
export const idle: Policy = {
  name: 'idle',
  act: () => null,
  hostKill: () => ({ noKill: true }),
  vote: () => null,
};

/** Nobody acts at night. Each day everyone votes out the lowest-seat living wolf. Ends in a Village win. */
export const villageWin: Policy = {
  name: 'village-win',
  act: () => null,
  hostKill: () => ({ noKill: true }),
  vote(ctx, _voter, _ballot, candidates) {
    return first(candidates, ctx.wolves().sort(bySeat)) ?? candidates[0] ?? null;
  },
};

/**
 * Wolves kill the lowest-seat living non-wolf, the Alpha also infects the
 * next one, nobody protects, and every vote goes to a living non-wolf.
 * Ends in a Wolf Pack win.
 */
export const wolfWin: Policy = {
  name: 'wolf-win',
  act(ctx, actor, ability) {
    if (!actor.wolfAligned) return null;
    const victims = ctx.others().sort(bySeat);
    if (ability.capability === 'KILL' && victims[0]) return { targetPlayerIds: [victims[0].playerId] };
    if (ability.capability === 'INFECT' && !ability.exclusiveGroup && victims[1]) return { targetPlayerIds: [victims[1].playerId] };
    return null;
  },
  hostKill: (_ctx, view) => (view.candidates[0] ? { targetPlayerId: view.candidates[0].playerId } : { noKill: true }),
  vote(ctx, voter, _ballot, candidates) {
    const target = first(candidates, ctx.others().sort(bySeat).filter((p) => p.playerId !== voter.playerId));
    return target ?? candidates[0] ?? null;
  },
};

/**
 * Day 1 ends in a tie on both ballots: two living non-wolves vote for each
 * other and the rest split evenly. Nobody acts at night.
 */
export const tieTwice: Policy = {
  name: 'tie-twice',
  act: () => null,
  hostKill: () => ({ noKill: true }),
  vote(ctx, voter, ballot, candidates) {
    const key = `tie.${ctx.state.roundNumber}`;
    let pair = ctx.memo.get(key) as [string, string] | undefined;
    if (!pair) {
      const [a, b] = ctx.others().sort(bySeat);
      pair = [a!.playerId, b!.playerId];
      ctx.memo.set(key, pair);
    }
    const [a, b] = pair;
    if (ballot === 2 && !(candidates.includes(a) || candidates.includes(b))) return null;
    if (voter.playerId === a) return b;
    if (voter.playerId === b) return a;
    const rest = ctx
      .alive()
      .sort(bySeat)
      .filter((p) => p.playerId !== a && p.playerId !== b);
    const index = rest.findIndex((p) => p.playerId === voter.playerId);
    // An odd seat out abstains so the split stays even.
    if (rest.length % 2 === 1 && index === rest.length - 1) return null;
    return index % 2 === 0 ? a : b;
  },
};

/** Day 1 votes out the first living seat holding `roleId`; afterwards `then` plays on. */
export function voteOutRole(roleId: string, then: Policy): Policy {
  return {
    name: `vote-out-${roleId}+${then.name}`,
    act: (ctx, actor, ability) => then.act(ctx, actor, ability),
    hostKill: (ctx, view) => then.hostKill(ctx, view),
    vote(ctx, voter, ballot, candidates) {
      if (ctx.state.roundNumber === 1) {
        const target = ctx.alive().find((p) => p.currentRoleId === roleId);
        if (target && candidates.includes(target.playerId)) return target.playerId;
        if (target?.playerId === voter.playerId) return null;
      }
      return then.vote(ctx, voter, ballot, candidates);
    },
  };
}

/** A choice that satisfies the ability's target rule, picked at random, or null when none exists. */
export function randomChoice(ctx: PhaseContext, actor: RosterEntry, ability: AbilityView): Choice | null {
  const rule = ability.target;
  switch (rule.kind) {
    case 'NONE':
    case 'FINAL_WOLF_TARGET':
    case 'OWN_RESULT':
      return { targetPlayerIds: [] };
    case 'QUESTION':
      return rule.questions[0] ? { targetPlayerIds: [], payload: { question: rule.questions[0] } } : null;
    case 'TEXT':
      return { targetPlayerIds: [], payload: { hint: 'Watch the quiet corner of the square.'.slice(0, rule.maxLength) } };
    case 'PLAYERS': {
      const pool = ctx.roster.filter((p) => p.lifeStatus === rule.life && (rule.self || p.playerId !== actor.playerId)).map((p) => p.playerId);
      if (pool.length < rule.count) return null;
      return { targetPlayerIds: ctx.rng.sample(pool, rule.count) };
    }
  }
}

/**
 * Every open ability is used with probability `actRate`, with a random legal
 * target. One ability per exclusive group. The host picks a random submitted
 * name, and votes are random. Ends however it ends, inside the round cap.
 */
export function randomLegal(actRate = 0.8): Policy {
  return {
    name: 'random-legal',
    act(ctx, actor, ability) {
      if (!ctx.rng.chance(actRate)) return null;
      if (ability.exclusiveGroup) {
        const key = `group.${ctx.state.roundNumber}.${ctx.state.phase}.${actor.playerId}.${ability.exclusiveGroup}`;
        if (ctx.memo.has(key)) return null;
        ctx.memo.set(key, true);
      }
      return randomChoice(ctx, actor, ability);
    },
    hostKill(ctx, view) {
      const pick = ctx.rng.chance(0.85) ? ctx.rng.pick(view.candidates) : undefined;
      return pick ? { targetPlayerId: pick.playerId } : { noKill: true };
    },
    vote(ctx, _voter, _ballot, candidates) {
      if (ctx.rng.chance(0.1)) return null;
      return ctx.rng.pick(candidates) ?? null;
    },
  };
}
