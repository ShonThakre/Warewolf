import type { ReactNode, SVGProps } from 'react';

/** Compact, consistent action symbols drawn as vectors so they stay crisp at small sizes. */
export type GameIconName = 'infect' | 'kill' | 'shield' | 'heal' | 'potion' | 'magnifier' | 'vote' | 'settings' | 'timer';

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
