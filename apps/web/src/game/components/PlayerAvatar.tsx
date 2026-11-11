import { avatarArtUrl, uiArtUrl } from '../../assets/art';
import { initials } from './initials';

export interface PlayerAvatarProps {
  name: string;
  /** `nav` fits the top bar. `table` is the seat monogram. */
  size?: 'table' | 'nav';
  /** 1–36. A missing file falls back to initials. */
  avatarId?: number | null;
  /** An empty seat uses `mystery_avatar`, then initials. */
  empty?: boolean;
  /** Rendered in the existing seat list when a player has been eliminated. */
  dead?: boolean;
}

/** Illustrated avatar, or initials when the file is not here yet. The name beside it is the accessible label. */
export function PlayerAvatar({ name, size = 'table', avatarId = null, empty = false, dead = false }: PlayerAvatarProps) {
  const url = empty ? uiArtUrl('mystery_avatar') : avatarId != null ? avatarArtUrl(avatarId) : null;
  return (
    <span className={`ww-avatar${size === 'nav' ? ' is-nav' : ''}${dead ? ' is-dead' : ''}`} aria-hidden="true">
      {url ? <img className="ww-avatar-img" src={url} alt="" /> : initials(name)}
    </span>
  );
}
