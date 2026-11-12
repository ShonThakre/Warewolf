import { killTargetViewSchema, type KillDecision, type KillTargetView } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { FIXTURE_GAME_ID, fixturePlayerId } from './role';

/**
 * GET /games/:gameId/host/kill-target fixtures (WW-803a). The candidates are
 * the players the pack named. They are host-only.
 */

export function killTargetFixture(
  options: {
    readonly phase?: GamePhase;
    readonly roundNumber?: number;
    readonly candidates?: KillTargetView['candidates'];
    readonly decision?: KillDecision | null;
    readonly editable?: boolean;
  } = {},
): KillTargetView {
  const phase = options.phase ?? 'NIGHT_HOST_CONFIRM';
  return killTargetViewSchema.parse({
    gameId: FIXTURE_GAME_ID,
    phase,
    roundNumber: options.roundNumber ?? 1,
    candidates: options.candidates ?? [
      { playerId: fixturePlayerId(12), submittedBy: [fixturePlayerId(1)] },
      { playerId: fixturePlayerId(14), submittedBy: [fixturePlayerId(2)] },
    ],
    decision: options.decision === undefined ? null : options.decision,
    editable: options.editable ?? phase === 'NIGHT_HOST_CONFIRM',
  });
}
