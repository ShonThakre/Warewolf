import type { RouteObject } from 'react-router';
import { LayoutPreview } from './game/layout/LayoutPreview';
import { Home } from './routes/Home';
import { Lobby } from './routes/Lobby';
import { Results } from './routes/Results';
import { Reveal } from './routes/Reveal';
import { Roles } from './routes/Roles';
import { Setup } from './routes/Setup';
import { Table } from './routes/Table';
import { NotFound } from './routes/NotFound';
import { Placeholder } from './routes/Placeholder';
import { AppShell } from './shell/AppShell';

/** Routes from docs/werewolf/ui-ux-plan.md, section 5. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'roles', element: <Roles /> },
      { path: 'how-to-play', element: <Placeholder title="How to play" audience="Anyone" task="WW-1201" /> },
      { path: 'lobby/:gameId', element: <Lobby /> },
      { path: 'lobby/:gameId/setup', element: <Setup /> },
      { path: 'game/:gameId/reveal', element: <Reveal /> },
      { path: 'game/:gameId', element: <Table /> },
      {
        path: 'game/:gameId/host',
        element: <Placeholder title="Host dashboard" audience="Host. Others see a not-available state" task="WW-1202" />,
      },
      { path: 'game/:gameId/results', element: <Results /> },
      // WEB-02: fixture previews of GameLayout for styling and viewport checks. Never in a production build.
      ...(import.meta.env.DEV ? [{ path: 'dev/layout/:stage?', element: <LayoutPreview /> }] : []),
      { path: '*', element: <NotFound /> },
    ],
  },
];
