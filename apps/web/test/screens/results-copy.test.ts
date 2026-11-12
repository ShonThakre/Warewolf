import { describe, expect, it } from 'vitest';
import { cancelledResultsFixture, finishedResultsFixture } from '../../src/game/fixtures/results';
import { bannerOutcome, cancelReasonCopy, infectionLine, resultsReason, resultsTitle, roleLabel, seatRoles } from '../../src/game/components/resultsCopy';
import { resultsHeadline } from '../../src/game/state/results';

describe('results copy', () => {
  it('names the winning team and a conversion without a role id', () => {
    const wolves = finishedResultsFixture();
    const infected = wolves.seats.find((seat) => seat.playerId === wolves.infections[0]!.targetPlayerId)!;
    expect(resultsTitle(resultsHeadline(wolves))).toBe('Wolf wins');
    expect(resultsReason(wolves)).toContain('The Wolf team wins.');
    expect(seatRoles(infected)).toBe(`Started as ${roleLabel(infected.originalRoleId)}. Ended as Infected Wolf.`);
    expect(infectionLine(wolves, wolves.infections[0]!)).toContain('infected');
    expect(bannerOutcome(wolves)).toBe('wolves');
    expect(bannerOutcome(finishedResultsFixture({ winningTeam: 'VILLAGE' }))).toBe('village');
    expect(bannerOutcome(finishedResultsFixture({ draw: true }))).toBe('draw');
    const text = [resultsTitle(resultsHeadline(wolves)), resultsReason(wolves), seatRoles(infected), infectionLine(wolves, wolves.infections[0]!)].join(' ');
    expect(text).not.toMatch(/alpha_wolf|infected_wolf|WOLF_PACK/);
  });

  it('keeps a cancelled game to a reason, with no role', () => {
    expect(cancelReasonCopy('HOST')).toBe('The host cancelled the game.');
    expect(cancelReasonCopy('SURRENDER')).toBe('The table surrendered.');
    expect(JSON.stringify(cancelledResultsFixture())).not.toMatch(/RoleId|alpha_wolf|Villager/);
  });
});
