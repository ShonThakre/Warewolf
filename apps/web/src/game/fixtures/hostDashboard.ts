import type { HostDashboard } from '@warewolf/contracts';
import { fixtureId, hostRosterFixture } from './role';

/**
 * A host dashboard for screens, stories, and tests (WW-1202a, for WW-1202).
 * Round 2 of the 20-seat Infection deal from `hostRosterFixture`, voting
 * open: one villager was infected and one killed on night 1, one villager
 * was voted out on day 1, and the Alpha has submitted tonight's choices.
 */
export function hostDashboardFixture(): HostDashboard {
  const base = hostRosterFixture();
  const alpha = base.players.find((p) => p.originalRoleId === 'alpha_wolf')!;
  const villagers = base.players.filter((p) => p.originalFaction === 'VILLAGE' && !p.isHost);
  const [infected, nightDead, dayDead, failedTarget] = villagers;
  const players = base.players.map((p) => {
    if (p.playerId === infected!.playerId) return { ...p, currentRoleId: 'infected_wolf', currentProfileId: 'infected_wolf', currentFaction: 'WOLF_PACK' as const, wolfAligned: true };
    if (p.playerId === nightDead!.playerId || p.playerId === dayDead!.playerId) return { ...p, lifeStatus: 'DEAD' as const };
    return p;
  });
  const voters = players.filter((p) => p.lifeStatus === 'ALIVE').slice(0, 5);

  return {
    overview: {
      status: 'ACTIVE',
      phase: 'VOTING',
      roundNumber: 2,
      stateVersion: 14,
      phaseEndsAt: null,
      alive: 18,
      wolfAlignedAlive: 2,
      infection: { enabled: true, successes: 1, max: 4, sealed: false },
    },
    roster: { gameId: base.gameId, phase: 'VOTING', roundNumber: 2, players },
    submissions: [
      {
        actionId: fixtureId(5001),
        playerId: alpha.playerId,
        abilityId: 'alpha_kill',
        window: 'NIGHT_SUBMIT',
        targetPlayerIds: [failedTarget!.playerId],
        status: 'RESOLVED',
        rejectedReason: null,
        submittedAt: '2026-11-11T21:02:00.000Z',
      },
    ],
    infections: [
      { roundNumber: 1, sourcePlayerId: alpha.playerId, targetPlayerId: infected!.playerId, outcome: 'SUCCESS', failureReason: null },
      { roundNumber: 2, sourcePlayerId: alpha.playerId, targetPlayerId: failedTarget!.playerId, outcome: 'FAILED', failureReason: 'TARGET_INELIGIBLE' },
    ],
    ballots: [
      {
        roundNumber: 1,
        ballot: 1,
        open: false,
        votes: voters.slice(0, 4).map((v) => ({ voterPlayerId: v.playerId, targetPlayerId: dayDead!.playerId, weight: 1 })),
        counts: [{ targetPlayerId: dayDead!.playerId, total: 4 }],
      },
      {
        roundNumber: 2,
        ballot: 1,
        open: true,
        votes: [
          ...voters.slice(0, 3).map((v) => ({ voterPlayerId: v.playerId, targetPlayerId: alpha.playerId, weight: 1 })),
          { voterPlayerId: voters[3]!.playerId, targetPlayerId: null, weight: 1 },
        ],
        counts: [
          { targetPlayerId: alpha.playerId, total: 3 },
          { targetPlayerId: null, total: 1 },
        ],
      },
    ],
    eliminations: [
      {
        roundNumber: 1,
        phaseKind: 'NIGHT',
        playerId: nightDead!.playerId,
        roleAtDeath: nightDead!.currentRoleId,
        factionAtDeath: 'VILLAGE',
        causes: [{ type: 'WOLF_KILL', via: 'PACK', actorIds: [alpha.playerId] }],
        revealedPublicly: false,
      },
      {
        roundNumber: 1,
        phaseKind: 'DAY',
        playerId: dayDead!.playerId,
        roleAtDeath: dayDead!.currentRoleId,
        factionAtDeath: 'VILLAGE',
        causes: [{ type: 'DAY_VOTE', via: 'EFFECT', actorIds: voters.slice(0, 4).map((v) => v.playerId).sort() }],
        revealedPublicly: false,
      },
    ],
    victory: { outcome: null, individuals: [] },
  };
}
