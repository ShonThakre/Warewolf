import type { GamePhase } from '@warewolf/domain';
import type { SceneId } from '../../assets/art';

/**
 * What the stage shows in each phase (docs/werewolf/ui-ux-plan.md, section 4,
 * "Stage modes"). Only the stage content and the enabled action change
 * between phases; the layout does not.
 */

export const STAGE_MODES = ['lobby', 'reveal', 'night', 'night-results', 'day', 'voting', 'results'] as const;
export type StageMode = (typeof STAGE_MODES)[number];

/** What sits in front of the scene. */
export type Foreground =
  /** Seat avatars placed in the scene. */
  | 'avatars'
  /** Selectable seats: legal targets at night, eligible seats in a vote. */
  | 'player-grid'
  /** The public night summary. */
  | 'result-card'
  /** Victory banner and stat row. */
  | 'victory';

/** The primary control in the action row. Screens decide who may use it. */
export type ActionKind =
  /** Host: start. Everyone else: waiting copy. */
  | 'start'
  /** Players read their roles; the host begins the night from the host route. Everyone else waits. */
  | 'wait-for-host'
  | 'submit-ability'
  | 'continue-to-day'
  /** Shown when the server allows voting to open. */
  | 'open-voting'
  | 'confirm-vote'
  | 'play-again';

export interface StageSpec {
  /** Scene art for `sceneArtUrl`. `BY_OUTCOME` picks a victory scene from the result. */
  readonly scene: SceneId | 'BY_OUTCOME';
  /** Which background wash token: `--bg-night` or `--bg-day`. */
  readonly wash: 'night' | 'day';
  readonly foreground: Foreground;
  /**
   * Where the foreground goes in portrait. `scene`: over the scene, and the
   * middle shows the rail. `middle`: under a Players / rail switch, because
   * a target grid needs the room the scene cannot give it.
   */
  readonly portraitForeground: 'scene' | 'middle';
  readonly action: ActionKind;
}

export const STAGE_SPECS: Readonly<Record<StageMode, StageSpec>> = {
  lobby: { scene: 'lobby_campfire', wash: 'night', foreground: 'avatars', portraitForeground: 'scene', action: 'start' },
  reveal: { scene: 'square_night', wash: 'night', foreground: 'avatars', portraitForeground: 'scene', action: 'wait-for-host' },
  night: { scene: 'square_night', wash: 'night', foreground: 'player-grid', portraitForeground: 'middle', action: 'submit-ability' },
  'night-results': { scene: 'square_night', wash: 'night', foreground: 'result-card', portraitForeground: 'scene', action: 'continue-to-day' },
  day: { scene: 'square_day', wash: 'day', foreground: 'avatars', portraitForeground: 'scene', action: 'open-voting' },
  voting: { scene: 'square_dusk', wash: 'day', foreground: 'player-grid', portraitForeground: 'middle', action: 'confirm-vote' },
  results: { scene: 'BY_OUTCOME', wash: 'day', foreground: 'victory', portraitForeground: 'scene', action: 'play-again' },
};

/**
 * The stage for a server phase. Resolution happens inside a phase close, so
 * it has no stage of its own. A cancelled game shows the results stage,
 * which states the cancellation without revealing roles.
 */
export function stageModeFor(phase: GamePhase): StageMode {
  switch (phase) {
    case 'LOBBY':
      return 'lobby';
    case 'ROLE_REVEAL':
      return 'reveal';
    case 'NIGHT_SUBMIT':
    case 'NIGHT_HOST_CONFIRM':
    case 'NIGHT_REACTION':
      return 'night';
    case 'DAY_ANNOUNCE':
      return 'night-results';
    case 'DAY_DISCUSSION':
      return 'day';
    case 'VOTING':
    case 'REVOTE':
      return 'voting';
    case 'FINISHED':
    case 'CANCELLED':
      return 'results';
  }
}
