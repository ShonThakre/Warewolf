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
