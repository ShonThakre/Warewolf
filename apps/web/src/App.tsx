import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider, type createMemoryRouter } from 'react-router';
import { routes } from './routes';
import { theme } from './theme/theme';
import { tokensToCss } from './theme/tokens';

const tokenCss = tokensToCss();

type AppRouter = ReturnType<typeof createBrowserRouter> | ReturnType<typeof createMemoryRouter>;

/** One ThemeProvider wraps the router. Tests pass a memory router. */
export function App({ router }: { router?: AppRouter }) {
  const [activeRouter] = useState<AppRouter>(() => router ?? createBrowserRouter(routes));
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={tokenCss} />
      <RouterProvider router={activeRouter} />
    </ThemeProvider>
  );
}
