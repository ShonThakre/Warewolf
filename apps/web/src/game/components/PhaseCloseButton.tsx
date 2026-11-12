import type { GameState } from '@warewolf/contracts';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useId, useState } from 'react';
import type { ClosePhaseControl } from '../state/phase';
import { closeButtonLabel, closeConsequence, closeNeedsConfirm } from './phaseCopy';

/**
 * The host's phase button. Guests render nothing: `canClose` is false for
 * them. The label and the consequence come from `state.close`. A close that
 * resolves something, or ends a window where players are choosing, asks first.
 * The question belongs to the phase it was asked in: if the game moves on
 * while it is open, it closes rather than offering the next phase's close.
 */
export function PhaseCloseButton({
  control,
  onClosed,
  tone = 'secondary',
}: {
  control: ClosePhaseControl;
  onClosed?: (state: GameState) => void;
  /** `primary` keeps the host control apart from a gold player action in the same row. */
  tone?: 'primary' | 'secondary';
}) {
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const titleId = useId();
  if (!control.canClose || !control.close) return null;
  const label = closeButtonLabel(control.close, control.phase);
  const consequence = closeConsequence(control.close, control.phase);
  const needsConfirm = closeNeedsConfirm(control.close, control.phase);
  const windowKey = `${control.phase}:${control.close.next}:${control.close.resolves}`;
  const confirming = askedFor === windowKey;

  function run() {
    void control.closePhase().then((next) => {
      setAskedFor(null);
      if (next) onClosed?.(next);
    });
  }

  return (
    <>
      <Button
        variant="contained"
        color={tone}
        disabled={control.isClosing}
        title={consequence}
        onClick={() => (needsConfirm ? setAskedFor(windowKey) : run())}
      >
        {control.isClosing ? 'Working…' : label}
      </Button>
      <Dialog open={confirming} onClose={() => (control.isClosing ? undefined : setAskedFor(null))} fullWidth maxWidth="xs" aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{label}?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">{consequence}</p>
          <p className="ww-dialog-copy">This cannot be undone.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAskedFor(null)} disabled={control.isClosing}>
            Not yet
          </Button>
          <Button variant="contained" color="secondary" onClick={run} disabled={control.isClosing}>
            {control.isClosing ? 'Working…' : label}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
