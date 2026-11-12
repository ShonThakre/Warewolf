import { DEFAULT_CATALOG, type RoleCatalog } from '../catalog/catalog.js';
import type { IndividualTrigger, VictoryDefinition } from '../catalog/types.js';
import { victoryForSeat } from '../config/resolve.js';
import type { Faction } from '../factions.js';
import type { LifeStatus } from '../game.js';
import type { IndividualVictoryState } from '../roles.js';
import type { PlayerId, RoleId } from '../snapshot.js';

/**
 * Pure victory evaluator (the domain half of WW-902). Order follows
 * game-rules.md, section 9. The phase close calls it later.
 *
 * A team win ends the game and keeps individual wins. A converted role's
 * individual win is revoked. Chaos Demon's condition is checked on every
 * call and, once true, stays achieved.
 *
 * Vampire team, from the Ultimate 20 images: a living Vampire and a living
 * Servant when the game ends, or the Vampire team still alive after both
 * Village and Wolves are gone. That second path is not a Village win.
 * Mind Controller stays the unresolved alive-at-end default (OD-76).
 */

export interface VictoryPlayer {
  readonly id: PlayerId;
  readonly lifeStatus: LifeStatus;
}

export interface VictoryAssignment {
  readonly playerId: PlayerId;
  readonly currentRoleId: RoleId;
  readonly currentProfileId: string;
  readonly currentFaction: Faction;
  readonly wolfAligned: boolean;
  readonly individualVictory: IndividualVictoryState;
  /** The trigger revoked when this seat was converted off an individual role. */
  readonly revokedTrigger?: IndividualTrigger;
  /** Assassin variant A. Null when this seat has no mark. */
  readonly markTargetPlayerId?: PlayerId | null;
}

export interface VictoryInput {
  readonly round: number;
  readonly roundCap: number;
  /** True when this call is the round-cap check and the cap has been reached. */
  readonly roundCapReached?: boolean;
  readonly players: readonly VictoryPlayer[];
  readonly assignments: readonly VictoryAssignment[];
  /** Players eliminated by the day vote that just closed. */
  readonly dayEliminated?: readonly PlayerId[];
  /** Necromancer ids who have revived at least one player. */
  readonly revivedBy?: readonly PlayerId[];
  /** Chaos events that changed the game, including ones already stored. */
  readonly chaosSuccesses?: number;
  /** Set once CHAOS_THREE_AND_FINAL_FIVE has been true. It does not turn back off. */
  readonly chaosAchieved?: boolean;
  readonly catalog?: RoleCatalog;
}

export interface VictoryIndividual {
  readonly playerId: PlayerId;
  readonly trigger: IndividualTrigger;
  readonly state: 'ACHIEVED' | 'REVOKED';
}

export interface VictoryResult {
  readonly ended: boolean;
  readonly team: 'VILLAGE' | 'WOLF_PACK' | null;
  readonly draw: boolean;
  readonly individuals: readonly VictoryIndividual[];
  /** True once the Chaos Demon has met the condition, including on earlier calls. */
  readonly chaosAchieved: boolean;
}

function victoryOf(assignment: VictoryAssignment, catalog: RoleCatalog): VictoryDefinition | undefined {
  const victory = catalog.byId.get(assignment.currentRoleId)?.profiles[assignment.currentProfileId]?.victory;
  if (!victory) return undefined;
  // OD-73: a Neutral or Independent seat whose catalog victory is the team victory survives instead.
  return victoryForSeat(victory, assignment.currentFaction);
}

function living(input: VictoryInput): VictoryPlayer[] {
  return input.players.filter((p) => p.lifeStatus === 'ALIVE');
}

/**
 * Evaluates one moment. Deaths and conversions are already on the input.
 * End-of-game individual triggers are recorded only when a team win, an empty
 * table, or the round cap is ending the game.
 */
export function evaluateVictory(input: VictoryInput): VictoryResult {
  const catalog = input.catalog ?? DEFAULT_CATALOG;
  const alive = new Set(living(input).map((p) => p.id));
  const wolves = input.assignments.filter((a) => a.currentFaction === 'WOLF_PACK' && alive.has(a.playerId));
  const others = [...alive].filter((id) => !wolves.some((w) => w.playerId === id));
  const wolfAlignedAlive = input.assignments.some((a) => a.wolfAligned && alive.has(a.playerId));
  const villageAlive = input.assignments.some((a) => a.currentFaction === 'VILLAGE' && alive.has(a.playerId));
  const wolvesWin = wolves.length > 0 && wolves.length >= others.length;
  const noTeams = !villageAlive && wolves.length === 0;
  const cap = input.roundCapReached === true || input.round >= input.roundCap;
  const livingServants = input.assignments.filter((a) => a.currentRoleId === 'vampire_servant' && alive.has(a.playerId));
  const livingVampire = input.assignments.some((a) => a.currentRoleId === 'vampire' && alive.has(a.playerId));
  const pair = livingVampire && livingServants.length > 0;
  /** Village and Wolves are both gone, and someone on the Vampire team is alive. */
  const wipe = !villageAlive && wolves.length === 0 && alive.size > 0 && (livingVampire || livingServants.length > 0);
  const villageWins = alive.size > 0 && !wolfAlignedAlive && !wipe;
  const ending = villageWins || wolvesWin || noTeams || cap || wipe;

  const dayEliminated = new Set(input.dayEliminated ?? []);
  const revivedBy = new Set(input.revivedBy ?? []);
  const successes = input.chaosSuccesses ?? 0;
  let chaosAchieved = input.chaosAchieved === true;
  const individuals: VictoryIndividual[] = [];

  for (const assignment of input.assignments) {
    const definition = victoryOf(assignment, catalog);
    if (assignment.individualVictory === 'REVOKED' || (assignment.individualVictory === 'ACHIEVED' && definition?.type !== 'INDIVIDUAL')) {
      const trigger = assignment.revokedTrigger ?? (definition?.type === 'INDIVIDUAL' ? definition.trigger : undefined);
      if (trigger) individuals.push({ playerId: assignment.playerId, trigger, state: 'REVOKED' });
      continue;
    }
    if (!definition || definition.type !== 'INDIVIDUAL') continue;
    const trigger = definition.trigger;
    const isAlive = alive.has(assignment.playerId);
    let achieved = false;
    switch (trigger) {
      case 'ELIMINATED_BY_DAY_VOTE':
        achieved = dayEliminated.has(assignment.playerId);
        break;
      case 'MARKED_TARGET_ELIMINATED': {
        const mark = assignment.markTargetPlayerId;
        achieved = mark != null && !alive.has(mark);
        break;
      }
      case 'SOLE_SURVIVOR':
        achieved = isAlive && alive.size === 1;
        break;
      case 'ALL_WOLVES_ELIMINATED_WHILE_ALIVE':
        achieved = isAlive && !wolfAlignedAlive;
        break;
      case 'CHAOS_THREE_AND_FINAL_FIVE':
        if (isAlive && (chaosAchieved || successes >= 3) && alive.size <= 5) {
          chaosAchieved = true;
          achieved = true;
        } else if (chaosAchieved && isAlive) {
          achieved = true;
        }
        break;
      case 'ALIVE_AT_GAME_END':
        achieved = ending && isAlive;
        break;
      case 'ALIVE_WITH_SERVANT':
        achieved = isAlive && ((pair && ending) || (wipe && livingVampire));
        break;
      case 'ALIVE_AFTER_REVIVE':
        achieved = ending && isAlive && revivedBy.has(assignment.playerId);
        break;
      case 'WITH_VAMPIRE':
        achieved = false;
        break;
      default:
        achieved = false;
    }
    if (achieved) individuals.push({ playerId: assignment.playerId, trigger, state: 'ACHIEVED' });
  }

  const vampireWon = individuals.some((i) => i.trigger === 'ALIVE_WITH_SERVANT' && i.state === 'ACHIEVED');
  if (vampireWon || (wipe && livingServants.length > 0)) {
    for (const assignment of input.assignments) {
      if (!alive.has(assignment.playerId)) continue;
      const definition = victoryOf(assignment, catalog);
      if (definition?.type === 'INDIVIDUAL' && definition.trigger === 'WITH_VAMPIRE') {
        individuals.push({ playerId: assignment.playerId, trigger: 'WITH_VAMPIRE', state: 'ACHIEVED' });
      }
    }
  }

  if (wipe) return { ended: true, team: null, draw: false, individuals, chaosAchieved };
  if (villageWins) return { ended: true, team: 'VILLAGE', draw: false, individuals, chaosAchieved };
  if (wolvesWin) return { ended: true, team: 'WOLF_PACK', draw: false, individuals, chaosAchieved };
  if (noTeams) {
    const any = individuals.some((i) => i.state === 'ACHIEVED');
    return { ended: true, team: null, draw: !any, individuals, chaosAchieved };
  }
  if (cap) return { ended: true, team: null, draw: true, individuals, chaosAchieved };
  return { ended: false, team: null, draw: false, individuals, chaosAchieved };
}
