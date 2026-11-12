import type { Faction } from '@warewolf/domain';
import { useState } from 'react';
import { roleArtUrl } from '../../assets/art';
import { initials } from './initials';
import { TEAM_KEY } from './roleCopy';
import './scene-art.css';

export interface RolePortraitProps {
  roleId: string;
  /** Display name, used for the monogram when the picture is absent. */
  name: string;
  faction: Faction;
  /** `tile` fills a catalog card. `card` sits on the private role card. `thumb` is a small square. */
  size?: 'tile' | 'card' | 'thumb';
  /** The reveal portrait is on screen immediately. Catalog tiles stay lazy. */
  loading?: 'eager' | 'lazy';
}

/**
 * Role art by role id, framed in the team color. When the file is absent or
 * fails to load, the frame shows a monogram crest instead of an empty well.
 * Decorative: the role name beside it is the accessible label.
 */
export function RolePortrait({ roleId, name, faction, size = 'tile', loading = 'lazy' }: RolePortraitProps) {
  const url = roleArtUrl(roleId);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url != null && failedUrl !== url;
  return (
    <span className="ww-portrait" data-team={TEAM_KEY[faction]} data-size={size} data-art={showImage ? 'image' : 'fallback'} aria-hidden="true">
      {showImage ? (
        <img src={url} alt="" loading={loading} decoding="async" draggable={false} onError={() => setFailedUrl(url)} />
      ) : (
        <span className="ww-portrait-crest">
          <span className="ww-portrait-moon" />
          <span className="ww-portrait-mono">{initials(name)}</span>
        </span>
      )}
    </span>
  );
}
