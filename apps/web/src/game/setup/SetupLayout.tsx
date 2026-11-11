import type { ReactNode } from 'react';
import { Button } from '@mui/material';
import { SETUP_STEPS, type SetupStep } from './setupDraft';
import { STEP_LABEL } from './setupCopy';
import './setup-layout.css';

export interface SetupLayoutProps {
  step: SetupStep;
  onStep: (step: SetupStep) => void;
  /** Portrait: one step. Landscape and desktop: the rail beside the canvas. */
  oneStep: boolean;
  summary: ReactNode;
  canvas: ReactNode;
  action: ReactNode;
}

/** Step rail plus canvas. The count strip is the first row in every mode. */
export function SetupLayout({ step, onStep, oneStep, summary, canvas, action }: SetupLayoutProps) {
  return (
    <div className="ww-setup" data-setup="" data-steps={oneStep ? 'one' : 'rail'}>
      <div className="ww-setup-strip">
        <h1 className="ww-setup-title">Game setup</h1>
        {summary}
      </div>
      <nav className="ww-setup-rail" aria-label="Setup steps">
        {SETUP_STEPS.map((id) => (
          <Button
            key={id}
            className="ww-setup-step"
            variant={id === step ? 'contained' : 'text'}
            aria-current={id === step ? 'step' : undefined}
            onClick={() => onStep(id)}
          >
            <StepIcon step={id} />
            <span className="ww-setup-step-label">{STEP_LABEL[id]}</span>
          </Button>
        ))}
      </nav>
      <div className="ww-setup-canvas">
        <h2 className="ww-setup-heading">{STEP_LABEL[step]}</h2>
        {canvas}
      </div>
      <div className="ww-setup-action">{action}</div>
    </div>
  );
}

function StepIcon({ step }: { step: SetupStep }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (step === 'mode') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="9" r="2" />
        <path d="M3 19c.8-3 2.8-4 5-4s4.2 1 5 4" />
        <path d="M14 19c.4-2 1.5-3 3-3 1.2 0 2.2.6 2.8 2" />
      </svg>
    );
  }
  if (step === 'roles') {
    return (
      <svg {...common}>
        <rect x="4" y="3" width="12" height="16" rx="2" />
        <path d="M8 8h5M8 12h5" />
      </svg>
    );
  }
  if (step === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5 11 15l4.5-5" />
    </svg>
  );
}
