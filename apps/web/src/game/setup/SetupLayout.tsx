import type { ReactNode } from 'react';
import { Button } from '@mui/material';
import { SETUP_STEPS, type SetupStep } from './setupDraft';
import { STEP_HINT, STEP_LABEL } from './setupCopy';
import './setup-layout.css';

export interface SetupLayoutProps {
  step: SetupStep;
  onStep: (step: SetupStep) => void;
  /** Portrait: the summary stacks above the canvas. Wider screens keep it beside the canvas. */
  oneStep: boolean;
  summary: ReactNode;
  canvas: ReactNode;
  action: ReactNode;
}

/** Step pills, the canvas, and the configuration card. Counts stay in the summary. */
export function SetupLayout({ step, onStep, oneStep, summary, canvas, action }: SetupLayoutProps) {
  const index = SETUP_STEPS.indexOf(step);
  const previous = SETUP_STEPS[index - 1];
  const next = SETUP_STEPS[index + 1];
  return (
    <div className="ww-setup" data-setup="" data-steps={oneStep ? 'one' : 'rail'}>
      <nav className="ww-setup-rail" aria-label="Setup steps">
        {SETUP_STEPS.map((id, position) => (
          <span key={id} className="ww-setup-step-slot">
            {position > 0 ? <span className="ww-setup-step-join" aria-hidden="true" /> : null}
            <Button
              className="ww-setup-step"
              variant={id === step ? 'contained' : 'text'}
              aria-current={id === step ? 'step' : undefined}
              aria-label={`${position + 1}. ${STEP_LABEL[id]}`}
              onClick={() => onStep(id)}
            >
              <span className="ww-setup-step-num" aria-hidden="true">
                {position + 1}
              </span>
              <span className="ww-setup-step-label">{STEP_LABEL[id]}</span>
            </Button>
          </span>
        ))}
      </nav>
      <div className="ww-setup-strip">
        <div className="ww-setup-head">
          <h1 className="ww-setup-title">Setup Game – {STEP_LABEL[step]}</h1>
          <p className="ww-setup-copy">{STEP_HINT[step]}</p>
        </div>
        {summary}
      </div>
      <div className="ww-setup-canvas">
        {canvas}
        {oneStep ? (
          <div className="ww-setup-pager">
            {previous ? (
              <Button variant="text" onClick={() => onStep(previous)}>
                ← {STEP_LABEL[previous]}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="outlined" onClick={() => onStep(next)}>
                Next: {STEP_LABEL[next]} →
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="ww-setup-action">{action}</div>
    </div>
  );
}
