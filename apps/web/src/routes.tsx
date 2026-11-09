import type { RouteObject } from 'react-router';
import { NotFound } from './routes/NotFound';
import { Placeholder } from './routes/Placeholder';
import { AppShell } from './shell/AppShell';

/** Routes from docs/werewolf/ui-ux-plan.md, section 5. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Placeholder title="Home" audience="Anyone" task="WW-304" /> },
      { path: 'roles', element: <Placeholder title="Role catalog" audience="Anyone. Public catalog" task="WW-1201" /> },
      { path: 'how-to-play', element: <Placeholder title="How to play" audience="Anyone" task="WW-1201" /> },
      { path: 'lobby/:gameId', element: <Placeholder title="Lobby" audience="Members" task="WW-304" /> },
      { path: 'game/:gameId/reveal', element: <Placeholder title="Role reveal" audience="Members, once" task="WW-404" /> },
      { path: 'game/:gameId', element: <Placeholder title="Game table" audience="Players" task="WW-1204" /> },
      {
        path: 'game/:gameId/host',
        element: <Placeholder title="Host dashboard" audience="Host. Others see a not-available state" task="WW-1202" />,
      },
      {
        path: 'game/:gameId/results',
        element: <Placeholder title="Results" audience="Members after the end" task="WW-1203" />,
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
