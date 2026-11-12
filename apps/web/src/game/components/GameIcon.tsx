import type { ReactNode, SVGProps } from 'react';

/** Compact, consistent action symbols drawn as vectors so they stay crisp at small sizes. */
export type GameIconName =
  | 'infect'
  | 'kill'
  | 'shield'
  | 'heal'
  | 'potion'
  | 'magnifier'
  | 'vote'
  | 'settings'
  | 'timer'
  | 'plus'
  | 'people'
  | 'layers'
  | 'card'
  | 'book'
  | 'chevron'
  | 'moon'
  | 'sun'
  | 'chat'
  | 'lock'
  | 'eyeOff'
  | 'check'
  | 'copy'
  | 'play'
  | 'send'
  | 'cross';

const paths: Record<GameIconName, ReactNode> = {
  infect: <><path d="M12 3v2M12 19v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  kill: <><path d="m5 19 14-14M7 5l12 12M4 8l4-4m8 16 4-4"/><path d="m12 9 3 3"/></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
  heal: <><path d="M12 21s-8-4.6-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.4-8 11-8 11Z"/><path d="M12 8v7m-3.5-3.5h7"/></>,
  potion: <><path d="M9 3h6m-5 0v5l-4.5 7.1A4.5 4.5 0 0 0 9.3 22h5.4a4.5 4.5 0 0 0 3.8-6.9L14 8V3"/><path d="M8 15h8"/><circle cx="11" cy="18" r=".7"/><circle cx="14.5" cy="17" r=".7"/></>,
  magnifier: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/><path d="M10.8 7v7.6m-3.8-3.8h7.6"/></>,
  vote: <><path d="m4 12 5 5L20 6"/><path d="M4 4h7M4 20h10"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.7 1l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.7-1l-1.5.6-1.5-2.6 1.3-1.1a7 7 0 0 1 0-2l-1.3-1.1 1.5-2.6 1.5.6a8 8 0 0 1 1.7-1l.3-1.6h3l.3 1.6a8 8 0 0 1 1.7 1l1.5-.6 1.5 2.6-1.3 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)"/></>,
  timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6m-3 0v3m5.7.3 1.4-1.4"/></>,
  plus: <path d="M12 5v14M5 12h14" />,
  people: <><circle cx="9" cy="8.2" r="2.5" /><circle cx="16" cy="9.2" r="2" /><path d="M3.8 18.2c.6-2.6 2.6-3.9 5.2-3.9s4.6 1.3 5.2 3.9" /><path d="M14.4 14.6c1.6.2 3 1.1 3.7 3" /></>,
  layers: <><path d="m4 14 8 4 8-4" /><path d="m4 10 8 4 8-4" /><path d="m4 6 8 4 8-4" /></>,
  card: <><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M8 9h5M8 12h8M8 15h6" /></>,
  book: <><path d="M3.5 6c2.8-1.2 5.6-1.1 8.5.8v12.5c-2.9-1.9-5.7-2-8.5-.8z" /><path d="M20.5 6c-2.8-1.2-5.6-1.1-8.5.8v12.5c2.9-1.9 5.7-2 8.5-.8z" /></>,
  chevron: <path d="M9 6.5 15 12l-6 5.5" />,
  moon: <path d="M19 14.2A7.5 7.5 0 0 1 9.8 5 7.8 7.8 0 1 0 19 14.2Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" /></>,
  chat: <><path d="M5.5 17.5 4 20.5l3.4-1.2A8.5 8.5 0 1 0 5.5 17.5Z" /><path d="M8.5 11h7M8.5 14h4.5" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  eyeOff: <><path d="M3.5 12s3.2-5.5 8.5-5.5S20.5 12 20.5 12s-3.2 5.5-8.5 5.5S3.5 12 3.5 12Z" /><circle cx="12" cy="12" r="2.4" /><path d="m4.5 4.5 15 15" /></>,
  check: <><circle cx="12" cy="12" r="8" /><path d="m8.2 12.2 2.5 2.5 5.1-5.2" /></>,
  copy: <><rect x="8.5" y="8.5" width="10" height="12" rx="2" /><path d="M6.5 15.5V5.5A2 2 0 0 1 8.5 3.5h8" /></>,
  play: <path d="M9 6.5v11l9-5.5z" />,
  send: <path d="m4.5 11.2 15-7.2-4.2 16.2-4.1-6.4-6.7-2.6z" />,
  cross: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
};

export interface GameIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: GameIconName;
  size?: number;
}

export function GameIcon({ name, size = 20, ...props }: GameIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
