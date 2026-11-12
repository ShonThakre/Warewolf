import type { CancelledResults, FinishedResults, ResultSeat } from '@warewolf/contracts';
import type { Faction } from '@warewolf/domain';
import { hostRosterFixture } from './role';

/**
 * Recaps for screens, stories, and tests (WW-903a, for WW-903 and WW-1203).
 * Built from the same dealt 20-seat Infection Edition table as the host
 * roster fixture, so role ids and factions are real.
 *
 * The finished recap: the Alpha infected one villager on night 1, two
 * villagers died at night, and the table voted out another villager on day 1. `winningTeam` picks the
 * outcome; `draw: true` gives a drawn game.
 */
export function finishedResultsFixture(options: { winningTeam?: Faction | null; draw?: boolean } = {}): FinishedResults {
  const roster = hostRosterFixture();
  const winningTeam = options.draw ? null : options.winningTeam === undefined ? 'WOLF_PACK' : options.winningTeam;
  const alpha = roster.players.find((p) => p.originalRoleId === 'alpha_wolf')!;
  const villagers = roster.players.filter((p) => p.originalFaction === 'VILLAGE');
  const infected = villagers[0]!;
  const nightDeaths = new Set([villagers[1]!.playerId, villagers[2]!.playerId]);
  const votedOut = villagers[3]!;

  const seats: ResultSeat[] = roster.players.map((p) => {
    const isInfected = p.playerId === infected.playerId;
    const finalRoleId = isInfected ? 'infected_wolf' : p.originalRoleId;
    const finalFaction: Faction = isInfected ? 'WOLF_PACK' : p.originalFaction;
    const death = nightDeaths.has(p.playerId)
      ? { roundNumber: 2, phaseKind: 'NIGHT' as const, roleId: finalRoleId }
      : p.playerId === votedOut.playerId
        ? { roundNumber: 1, phaseKind: 'DAY' as const, roleId: finalRoleId }
        : null;
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      seatNumber: p.seatNumber,
      avatarId: p.avatarId,
      isHost: p.isHost,
      originalRoleId: p.originalRoleId,
      originalFaction: p.originalFaction,
      finalRoleId,
      finalFaction,
      lifeStatus: death ? 'DEAD' : 'ALIVE',
      death,
      won: winningTeam !== null && finalFaction === winningTeam,
      individualWin: false,
      abilityUses: p.abilities.length > 0 ? 2 : 0,
    };
  });

  return {
    status: 'FINISHED',
    roundNumber: 3,
    winningTeam,
    draw: options.draw === true,
    seats,
    // Day 1: the table named the voted-out villager, 6 to 3, with 2 abstaining (OD-85).
    tallies: [
      {
        roundNumber: 1,
        ballot: 1,
        counts: [
          { targetPlayerId: votedOut.playerId, total: 6 },
          { targetPlayerId: alpha.playerId, total: 3 },
        ],
        abstentions: 2,
        votedOutPlayerId: votedOut.playerId,
        tiedPlayerIds: [],
      },
    ],
    infections: [{ roundNumber: 1, sourcePlayerId: alpha.playerId, targetPlayerId: infected.playerId }],
  };
}

export function cancelledResultsFixture(cancelReason: CancelledResults['cancelReason'] = 'HOST'): CancelledResults {
  return {
    status: 'CANCELLED',
    cancelReason,
    seats: hostRosterFixture().players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      seatNumber: p.seatNumber,
      avatarId: p.avatarId,
      isHost: p.isHost,
    })),
  };
}
