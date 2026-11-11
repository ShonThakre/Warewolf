import { AVATAR_COUNT } from '@warewolf/contracts';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { apiErrorOf } from '../../api/api';
import { useChangeAvatarMutation } from '../../api/lobby';
import { PlayerAvatar } from './PlayerAvatar';
import './scene-art.css';

export interface AvatarPickerProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  /** The seated player's current avatar, when the lobby has loaded it. */
  currentId: number | null;
  /** Avatars held by the other seats. */
  takenIds: readonly number[];
}

/** Lobby picker. A taken avatar stays disabled. Yours stays pressed. */
export function AvatarPicker({ open, onClose, gameId, currentId, takenIds }: AvatarPickerProps) {
  const [changeAvatar, state] = useChangeAvatarMutation();
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(takenIds);

  async function choose(avatarId: number) {
    if (avatarId === currentId) {
      onClose();
      return;
    }
    setError(null);
    const result = await changeAvatar({ gameId, avatarId });
    if ('error' in result) {
      const info = apiErrorOf(result.error);
      setError(info?.code === 'AVATAR_TAKEN' ? 'That avatar is already taken.' : (info?.message ?? 'The avatar could not be changed.'));
      return;
    }
    onClose();
  }

  return (
    <Dialog open={open} onClose={state.isLoading ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="avatar-picker-title">
      <DialogTitle id="avatar-picker-title">Choose an avatar</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <div className="ww-avatar-grid">
          {Array.from({ length: AVATAR_COUNT }, (_, index) => index + 1).map((id) => {
            const yours = id === currentId;
            const held = taken.has(id);
            const label = held ? `Avatar ${id}, taken` : yours ? `Avatar ${id}, yours` : `Avatar ${id}`;
            return (
              <Button
                key={id}
                aria-label={label}
                aria-pressed={yours}
                disabled={held || state.isLoading}
                onClick={() => void choose(id)}
              >
                <PlayerAvatar name={String(id)} avatarId={id} />
              </Button>
            );
          })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={state.isLoading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
