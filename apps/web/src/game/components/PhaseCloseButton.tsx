import type { GameState } from '@warewolf/contracts';
import { Button } from '@mui/material';
import type { ClosePhaseControl } from '../state/phase';
import { closeButtonLabel } from './phaseCopy';

/**
 * The host's phase button. Guests render nothing: `canClose` is false for
 * them. The label comes from `state.close`.
 */
export function PhaseCloseButton({ control, onClosed }: { control: ClosePhaseControl; onClosed?: (state: GameState) => void }) {
  if (!control.canClose || !control.close) return null;
  const label = closeButtonLabel(control.close);
  return (
    <Button
      variant="contained"
      color="secondary"
      disabled={control.isClosing}
      onClick={() => {
        void control.closePhase().then((next) => {
          if (next) onClosed?.(next);
        });
      }}
    >
      {label}
    </Button>
  );
}
