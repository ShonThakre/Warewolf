import { sceneArtUrl, type SceneId } from '../../assets/art';
import './scene-art.css';

/** Decorative village plate. A missing file leaves the wash behind it. */
export function VillageScene({ scene }: { scene: SceneId }) {
  const url = sceneArtUrl(scene);
  return (
    <div className="ww-village" data-scene={scene}>
      {url ? <img src={url} alt="" /> : null}
    </div>
  );
}
