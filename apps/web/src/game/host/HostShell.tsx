import type { ReactNode } from 'react';
import { Button } from '@mui/material';
import { HOST_SECTIONS, SECTION_LABEL, type HostSection } from './dashboardCopy';
import './host-screen.css';

export interface HostShellProps {
  section: HostSection;
  onSection: (section: HostSection) => void;
  /** Portrait stacks the sections as a scrolling chip row. */
  oneStep: boolean;
  canvas: ReactNode;
  action: ReactNode;
}

/** Sidebar plus canvas. Phase controls stay in the bottom bar on every size. */
export function HostShell({ section, onSection, oneStep, canvas, action }: HostShellProps) {
  return (
    <div className="ww-host" data-steps={oneStep ? 'one' : 'rail'}>
      <div className="ww-host-strip">
        <h1 className="ww-host-title">Host dashboard</h1>
      </div>
      <nav className="ww-host-rail" aria-label="Dashboard sections">
        {HOST_SECTIONS.map((id) => (
          <Button
            key={id}
            className="ww-host-section"
            variant={id === section ? 'contained' : 'text'}
            aria-current={id === section ? 'true' : undefined}
            onClick={() => onSection(id)}
          >
            <SectionIcon section={id} />
            <span className="ww-host-section-label">{SECTION_LABEL[id]}</span>
          </Button>
        ))}
      </nav>
      <div className="ww-host-canvas">
        <h2 className="ww-host-heading">{SECTION_LABEL[section]}</h2>
        {canvas}
      </div>
      <div className="ww-host-action">{action}</div>
    </div>
  );
}

function SectionIcon({ section }: { section: HostSection }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (section === 'players' || section === 'eliminations') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19c1.2-3 3.4-4 7-4s5.8 1 7 4" />
      </svg>
    );
  }
  if (section === 'votes' || section === 'victory') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.5 11 15l4.5-5" />
      </svg>
    );
  }
  if (section === 'events' || section === 'setup') {
    return (
      <svg {...common}>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
