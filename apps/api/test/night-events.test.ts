import { describe, expect, it } from 'vitest';
import { nightEventDrafts, type NightEventSource } from '../src/events/night-events.js';

const source = (extra: Partial<NightEventSource> = {}): NightEventSource => ({
  round: 1,
  investigations: [],
  infections: [],
  conversions: [],
  eliminations: [],
  blocks: [],
  ...extra,
});

describe('night event audiences (WW-804)', () => {
  it('sends an investigation to the actor and the host, and not to the public', () => {
    const drafts = nightEventDrafts(
      source({
        investigations: [
          {
            actionId: 'act-1',
            actorPlayerId: 'seeker',
            abilityId: 'seeker_investigate',
            kind: 'ALIGNMENT_WOLF_OR_NOT',
            targetPlayerIds: ['wolf'],
            result: { value: 'WOLF' },
          },
        ],
      }),
    );
    expect(drafts.map((row) => row.audience)).toEqual(['PLAYER', 'HOST']);
    expect(drafts[0]).toMatchObject({ recipientPlayerId: 'seeker', payload: { result: { value: 'WOLF' } } });
    expect(drafts[0]!.payload).not.toHaveProperty('actorPlayerId');
    expect(drafts[1]!.payload).toMatchObject({ actorPlayerId: 'seeker' });
    expect(JSON.stringify(drafts[0]!.payload)).not.toContain('pack_wolf');
  });

  it('hides the infection source on the converted player copy', () => {
    const drafts = nightEventDrafts(
      source({
        infections: [{ actionId: 'inf-1', sourcePlayerId: 'alpha', targetPlayerId: 'seeker', outcome: 'SUCCESS', roleId: 'infected_wolf' }],
        conversions: [{ playerId: 'seeker', toRoleId: 'infected_wolf', reason: 'INFECTION', revokedAbilityIds: ['seeker_investigate'] }],
      }),
    );
    const player = drafts.filter((row) => row.audience === 'PLAYER');
    const host = drafts.filter((row) => row.audience === 'HOST');
    expect(player.map((row) => row.type).sort()).toEqual(['INFECTION_OCCURRED', 'ROLE_CONVERTED']);
    expect(JSON.stringify(player)).not.toContain('alpha');
    expect(JSON.stringify(player)).not.toContain('sourcePlayerId');
    expect(host.find((row) => row.type === 'INFECTION_OCCURRED')!.payload).toMatchObject({ sourcePlayerId: 'alpha', targetPlayerId: 'seeker', roleId: 'infected_wolf' });
    expect(player.find((row) => row.type === 'ROLE_CONVERTED')!.payload).toEqual({
      roundNumber: 1,
      roleId: 'infected_wolf',
      revokedAbilityIds: ['seeker_investigate'],
    });
  });

  it('publishes a death without a role when the night does not reveal it, and tells a block target nothing about the blocker', () => {
    const drafts = nightEventDrafts(
      source({
        eliminations: [{ playerId: 'villager', seatNumber: 4, roleAtDeath: 'normal_villager', revealedPublicly: false }],
        blocks: [{ actionId: 'block-1', actorId: 'disruptor', targetId: 'seeker', informTarget: true, cancelledActionIds: [] }],
      }),
    );
    expect(drafts.find((row) => row.type === 'PLAYER_ELIMINATED')!.payload).toEqual({
      roundNumber: 1,
      playerId: 'villager',
      seatNumber: 4,
      roleId: null,
    });
    const told = drafts.find((row) => row.type === 'ACTION_BLOCKED' && row.audience === 'PLAYER')!;
    expect(told.payload).toEqual({ roundNumber: 1 });
    expect(JSON.stringify(told.payload)).not.toContain('disruptor');
    expect(drafts.find((row) => row.type === 'ACTION_BLOCKED' && row.audience === 'HOST')!.payload).toMatchObject({ actorId: 'disruptor' });
  });

  it('tells a promoted Servant and the Vampire team, and not the public', () => {
    const drafts = nightEventDrafts(
      source({
        conversions: [
          {
            playerId: 'villager',
            toRoleId: 'vampire_servant',
            reason: 'VAMPIRE',
            revokedAbilityIds: [],
            vampirePlayerId: 'vampire',
            teamPlayerIds: ['vampire', 'villager'],
          },
        ],
      }),
    );
    expect(drafts.some((row) => row.audience === 'PUBLIC')).toBe(false);
    const player = drafts.find((row) => row.type === 'ROLE_CONVERTED' && row.audience === 'PLAYER')!;
    expect(player.recipientPlayerId).toBe('villager');
    expect(player.payload).toMatchObject({ roleId: 'vampire_servant', vampirePlayerId: 'vampire', teamPlayerIds: ['vampire', 'villager'] });
    const team = drafts.find((row) => row.type === 'VAMPIRE_TEAM_JOIN' && row.audience === 'PLAYER')!;
    expect(team.recipientPlayerId).toBe('vampire');
    expect(team.payload).toMatchObject({ servantPlayerId: 'villager', vampirePlayerId: 'vampire' });
    expect(drafts.find((row) => row.type === 'ROLE_CONVERTED' && row.audience === 'HOST')!.payload).toMatchObject({
      playerId: 'villager',
      vampirePlayerId: 'vampire',
    });
  });

  it('does not tell a blocked player when informTarget is false, and skips a failed infection', () => {
    const drafts = nightEventDrafts(
      source({
        infections: [{ actionId: 'inf-1', sourcePlayerId: 'alpha', targetPlayerId: 'seeker', outcome: 'FAILED', roleId: null }],
        blocks: [{ actionId: 'block-1', actorId: 'disruptor', targetId: 'seeker', informTarget: false, cancelledActionIds: [] }],
      }),
    );
    expect(drafts.map((row) => `${row.type}:${row.audience}`)).toEqual(['ACTION_BLOCKED:HOST']);
  });
});

describe('Ultimate 20 outcomes (GAP-03)', () => {
  const special = {
    hints: [{ actionId: 'h-1', actorId: 'ghost', text: 'Look to the quiet corner.' }],
    silences: [{ actionId: 's-1', actorId: 'alchemist', targetId: 'villager' }],
    revivals: [{ actionId: 'r-1', actorId: 'necromancer', targetId: 'dead-seat' }],
    rewinds: [{ actionId: 'w-1', actorId: 'wizard', targetId: 'wolf', removedActionIds: ['kill-1'] }],
    copies: [{ actionId: 'c-1', actorId: 'mimic', targetId: 'dead-oracle', abilityIds: ['oracle_investigate'] }],
    chaosEvent: { actorId: 'demon', kind: 'NO_VOTE', playerIds: [], success: null },
  };

  it('makes the Ghost hint and the return public without naming the actor', () => {
    const drafts = nightEventDrafts(source({ special }));
    const pub = drafts.filter((d) => d.audience === 'PUBLIC');
    expect(pub.map((d) => [d.type, d.payload])).toEqual([
      ['GHOST_HINT', { roundNumber: 1, text: 'Look to the quiet corner.' }],
      ['PLAYER_RETURNED', { roundNumber: 1, playerId: 'dead-seat' }],
    ]);
    for (const d of pub) expect(JSON.stringify(d.payload)).not.toMatch(/ghost|necromancer/);
  });

  it('tells a silence to its target, and a rewind, a copy, and a Chaos event to their actor, without the source', () => {
    const drafts = nightEventDrafts(source({ special }));
    const own = drafts.filter((d) => d.audience === 'PLAYER').map((d) => [d.type, d.recipientPlayerId]);
    expect(own).toEqual([
      ['SILENCED', 'villager'],
      ['REWIND_RESULT', 'wizard'],
      ['ABILITY_COPIED', 'mimic'],
      ['CHAOS_EVENT', 'demon'],
    ]);
    const silenced = drafts.find((d) => d.type === 'SILENCED' && d.audience === 'PLAYER')!;
    expect(silenced.payload).toEqual({ roundNumber: 1 });
    expect(drafts.find((d) => d.type === 'REWIND_RESULT' && d.audience === 'PLAYER')!.payload).toEqual({ roundNumber: 1, targetPlayerIds: ['wolf'], cancelled: true });
  });

  it('gives the host every outcome with its actor, under its own dedupe key', () => {
    const drafts = nightEventDrafts(source({ special }));
    const host = drafts.filter((d) => d.audience === 'HOST');
    expect(host.map((d) => d.type)).toEqual(['GHOST_HINT', 'PLAYER_RETURNED', 'SILENCED', 'REWIND_RESULT', 'ABILITY_COPIED', 'CHAOS_EVENT']);
    for (const d of host) expect(d.payload).toHaveProperty('actorPlayerId');
    expect(new Set(drafts.map((d) => d.dedupeKey)).size).toBe(drafts.length);
  });

  it('adds nothing for a night without them', () => {
    expect(nightEventDrafts(source())).toEqual([]);
  });
});
