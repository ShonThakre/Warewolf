import type { SeatCredentials } from '@warewolf/contracts';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter } from 'react-router';
import { App } from '../src/App';
import { makeStore } from '../src/app/store';
import { routes } from '../src/routes';
import { memorySessionStorage } from '../src/session/storage';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Renders the app on a memory router. Fetch defaults to a not-found error. */
export function renderApp(path: string, options: { seat?: SeatCredentials | null; fetchFn?: typeof fetch } = {}) {
  const storage = memorySessionStorage(options.seat ?? null);
  const fetchFn =
    options.fetchFn ??
    ((async () => json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } })) as typeof fetch);
  const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <Provider store={store}>
      <App router={router} />
    </Provider>,
  );
  return { ...view, router, store, storage };
}

export { json };
