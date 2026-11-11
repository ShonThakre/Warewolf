import type { MyAction, MyActions, MyRole } from '@warewolf/contracts';
import type { Availability, GamePhase } from '@warewolf/domain';
import { fixtureId } from './role';

/**
 * GET /me/actions fixtures (WEB-07), built from a role fixture so ability ids
 * line up with GET /me. By default every ability is open in night 1's
 * submission window and nothing is chosen.
 */

export interface MyActionsFixtureOptions {
  readonly phase?: GamePhase;
  readonly roundNumber?: number;
  /** Per ability id. Defaults to OPEN. */
  readonly availability?: Readonly<Record<string, Availability>>;
  /** A choice per ability id: its targets, and whether the window has locked it. */
  readonly chosen?: Readonly<Record<string, { readonly targetPlayerIds: readonly string[]; readonly status?: MyAction['status'] }>>;
}

export function myActionsFixture(role: MyRole, options: MyActionsFixtureOptions = {}): MyActions {
  const phase = options.phase ?? 'NIGHT_SUBMIT';
  const roundNumber = options.roundNumber ?? 1;
  return {
    gameId: role.gameId,
    phase,
    roundNumber,
    abilities: role.abilities.map((ability, i) => {
      const choice = options.chosen?.[ability.abilityId];
      return {
        abilityInstanceId: ability.abilityInstanceId,
        abilityId: ability.abilityId,
        availability: options.availability?.[ability.abilityId] ?? 'OPEN',
        action: choice
          ? {
              actionId: fixtureId(5000 + role.seatNumber * 10 + i),
              status: choice.status ?? 'PENDING',
              abilityInstanceId: ability.abilityInstanceId,
              roundNumber,
              phase: ability.timing === 'NIGHT_REACTION' ? 'NIGHT_REACTION' : ability.timing === 'DAY' ? 'DAY_DISCUSSION' : 'NIGHT_SUBMIT',
              targetPlayerIds: [...choice.targetPlayerIds],
              payload: {},
            }
          : null,
      };
    }),
  };
}
