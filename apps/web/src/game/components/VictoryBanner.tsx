import { sceneArtUrl, uiArtUrl, type SceneId, type UiArtId } from '../../assets/art';
import './scene-art.css';

/** Public outcomes the results screen can paint. Cancelled games pass no outcome. */
export const VICTORY_OUTCOMES = ['village', 'wolves', 'lone-wolf', 'neutral', 'draw'] as const;
export type VictoryOutcome = (typeof VICTORY_OUTCOMES)[number];

const SCENE: Record<VictoryOutcome, SceneId> = {
  village: 'victory_village',
  wolves: 'victory_wolves',
  'lone-wolf': 'victory_lone_wolf',
  neutral: 'victory_neutral',
  draw: 'result_draw',
};

const RIBBON: Record<VictoryOutcome, UiArtId> = {
  village: 'ribbon_village',
  wolves: 'ribbon_wolves',
  'lone-wolf': 'ribbon_lone_wolf',
  neutral: 'ribbon_neutral',
  draw: 'ribbon_draw',
};

export interface VictoryBannerProps {
  title: string;
  reason: string;
  /** When set, the matching scene and ribbon are used. A missing file keeps the text. */
  outcome?: VictoryOutcome;
}

/**
 * Victory title over the result scene. The ribbon is decorative and sits behind the title.
 * Without a ribbon file, the title is the banner.
 */
export function VictoryBanner({ title, reason, outcome }: VictoryBannerProps) {
  const scene = outcome ? sceneArtUrl(SCENE[outcome]) : null;
  const ribbon = outcome ? uiArtUrl(RIBBON[outcome]) : null;
  return (
    <article className="ww-victory" aria-label="Result">
      {scene ? (
        <div className="ww-victory-scene" aria-hidden="true">
          <img src={scene} alt="" />
        </div>
      ) : null}
      {ribbon ? <img className="ww-victory-ribbon" src={ribbon} alt="" /> : null}
      <h2 className="ww-victory-title">{title}</h2>
      <p className="ww-victory-reason">{reason}</p>
    </article>
  );
}
