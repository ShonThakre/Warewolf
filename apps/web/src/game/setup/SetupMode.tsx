import type { GameConfiguration, GameMode } from '@warewolf/domain';
import { GAME_MODES, MODE_BOUNDS, getPack } from '@warewolf/domain';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import { MODE_LABEL } from '../components/lobbyCopy';
import { editedCardTitle, lockedModeCopy, PACK_STATUS_LABEL, replaceDialogCopy } from './setupCopy';
import { applyMode, applyPack, hasHandEdits, modeLocked, packsForMode, roleSummary, setPlayerCount } from './setupDraft';

interface PendingReplace {
  readonly next: GameConfiguration;
  readonly targetName: string;
}

export function SetupMode({
  draft,
  editable,
  basePackId,
  onDraft,
}: {
  draft: GameConfiguration;
  editable: boolean;
  /** The preset an edited setup came from. Null for a setup that started in Custom. */
  basePackId: string | null;
  onDraft: (next: GameConfiguration) => void;
}) {
  const [pending, setPending] = useState<PendingReplace | null>(null);
  const locked = modeLocked(draft);
  const lockedCopy = lockedModeCopy(draft.mode);
  const bounds = MODE_BOUNDS[draft.mode];
  const packs = packsForMode(draft.mode);
  // A hand-edited list. An empty Custom setup is the "Start empty" preset itself.
  const edited = hasHandEdits(draft) || (draft.rolePackId === 'custom' && draft.mode !== 'CUSTOM');
  const base = basePackId ? (getPack(basePackId) ?? null) : null;
  const resettable = edited && base != null && base.config.mode === draft.mode;

  /** Applies a change that loads a preset. An edited role list is confirmed first. */
  function request(next: GameConfiguration, targetName: string) {
    if (next === draft) return;
    const replaces = next.rolePackId !== 'custom' || next.roles.length === 0;
    if (replaces && hasHandEdits(draft)) setPending({ next, targetName });
    else onDraft(next);
  }

  const dialog = pending ? replaceDialogCopy(roleSummary(draft), pending.targetName, roleSummary(pending.next)) : null;

  return (
    <>
      {lockedCopy ? (
        <p className="ww-setup-copy">{lockedCopy}</p>
      ) : (
        <p className="ww-setup-copy">Choose a mode, then a preset. Editing roles or rules keeps a custom copy you can reset.</p>
      )}
      <div className="ww-setup-tools" role="group" aria-label="Game mode">
        {GAME_MODES.map((mode: GameMode) => (
          <Button
            key={mode}
            variant={draft.mode === mode ? 'contained' : 'outlined'}
            aria-pressed={draft.mode === mode}
            disabled={!editable}
            onClick={() => request(applyMode(draft, mode), MODE_LABEL[mode])}
          >
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
        {edited ? (
          <article className="ww-setup-role ww-setup-edited" aria-current="true">
            <p className="ww-catalog-name">{editedCardTitle(base?.name ?? null)}</p>
            <p className="ww-catalog-power">Edited · not saved as a preset</p>
            <p className="ww-setup-edited-summary">{roleSummary(draft)}</p>
            {resettable && editable ? (
              <Button className="ww-setup-edited-reset" variant="text" onClick={() => request(applyPack(draft, base.id), base.name)}>
                Reset to {base.name}
              </Button>
            ) : null}
          </article>
        ) : null}
        {packs.map((pack) => {
          const selected = draft.rolePackId === pack.id && !edited;
          const name = pack.id === 'custom' ? 'Start empty' : pack.name;
          return (
            <article key={pack.id} className="ww-setup-role">
              <Button
                className="ww-setup-role-open"
                variant={selected ? 'contained' : 'outlined'}
                disabled={!editable}
                aria-pressed={selected}
                onClick={() => request(applyPack(draft, pack.id), name)}
              >
                <span className="ww-catalog-name">{name}</span>
                <span className="ww-catalog-power">{PACK_STATUS_LABEL[pack.status]}</span>
                <span className="ww-catalog-power">{pack.description}</span>
                {pack.status === 'BLOCKED' ? <span className="ww-catalog-power">Blocked. {pack.blockedBy.join(', ')}</span> : null}
                <span className="ww-catalog-power">{pack.config.roles.length > 0 ? roleSummary(pack.config) : `${pack.config.playerCount} players`}</span>
              </Button>
            </article>
          );
        })}
      </div>
      <ModeBounds mode={draft.mode} />
      <Dialog open={dialog != null} onClose={() => setPending(null)} fullWidth maxWidth="xs" aria-labelledby="setup-replace-title">
        {dialog ? (
          <>
            <DialogTitle id="setup-replace-title">{dialog.title}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
              {dialog.lines.map((line) => (
                <p key={line} className="ww-setup-copy">
                  {line}
                </p>
              ))}
            </DialogContent>
            <DialogActions>
              <Button autoFocus onClick={() => setPending(null)}>
                {dialog.cancel}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  if (pending) onDraft(pending.next);
                  setPending(null);
                }}
              >
                {dialog.confirm}
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
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
