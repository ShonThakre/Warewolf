import type { GameConfiguration, GameMode } from '@warewolf/domain';
import { GAME_MODES, MODE_BOUNDS } from '@warewolf/domain';
import { Button, TextField } from '@mui/material';
import { MODE_LABEL } from '../components/lobbyCopy';
import { lockedModeCopy, PACK_STATUS_LABEL } from './setupCopy';
import { applyMode, applyPack, modeLocked, packsForMode, setPlayerCount } from './setupDraft';

export function SetupMode({
  draft,
  editable,
  onDraft,
}: {
  draft: GameConfiguration;
  editable: boolean;
  onDraft: (next: GameConfiguration) => void;
}) {
  const locked = modeLocked(draft);
  const lockedCopy = lockedModeCopy(draft.mode);
  const bounds = MODE_BOUNDS[draft.mode];
  const packs = packsForMode(draft.mode);

  return (
    <>
      {lockedCopy ? (
        <p className="ww-setup-copy">{lockedCopy}</p>
      ) : (
        <p className="ww-setup-copy">
          Choose a mode, then a preset. Editing a preset turns the setup into a custom list for that mode.
        </p>
      )}
      <div className="ww-setup-tools" role="group" aria-label="Game mode">
        {GAME_MODES.map((mode) => (
          <Button key={mode} variant={draft.mode === mode ? 'contained' : 'outlined'} aria-pressed={draft.mode === mode} disabled={!editable} onClick={() => onDraft(applyMode(draft, mode))}>
            {MODE_LABEL[mode]}
          </Button>
        ))}
      </div>
      <TextField
        className="ww-setup-number"
        label="Players"
        type="number"
        value={draft.playerCount}
        disabled={!editable || locked}
        helperText={locked ? `${MODE_LABEL[draft.mode]} uses ${bounds.min} players.` : `From ${bounds.min} to ${bounds.max}.`}
        onChange={(event) => onDraft(setPlayerCount(draft, Number(event.target.value)))}
        slotProps={{ htmlInput: { min: bounds.min, max: bounds.max, 'aria-label': 'Players' } }}
      />
      <div className="ww-setup-grid" aria-label="Role packs">
        {packs.map((pack) => {
          const selected = draft.rolePackId === pack.id;
          return (
            <article key={pack.id} className="ww-setup-role">
              <Button
                className="ww-setup-role-open"
                variant={selected ? 'contained' : 'outlined'}
                disabled={!editable}
                aria-pressed={selected}
                onClick={() => onDraft(applyPack(draft, pack.id))}
              >
                <span className="ww-catalog-name">{pack.name}</span>
                <span className="ww-catalog-power">{PACK_STATUS_LABEL[pack.status]}</span>
                <span className="ww-catalog-power">{pack.description}</span>
                {pack.status === 'BLOCKED' ? <span className="ww-catalog-power">Blocked. {pack.blockedBy.join(', ')}</span> : null}
                <span className="ww-catalog-power">{pack.config.playerCount} players</span>
              </Button>
            </article>
          );
        })}
      </div>
      <ModeBounds mode={draft.mode} />
    </>
  );
}

function ModeBounds({ mode }: { mode: GameMode }) {
  const bounds = MODE_BOUNDS[mode];
  return (
    <p className="ww-setup-copy">
      {MODE_LABEL[mode]} seats {bounds.min === bounds.max ? bounds.min : `${bounds.min} to ${bounds.max}`} players.
    </p>
  );
}
