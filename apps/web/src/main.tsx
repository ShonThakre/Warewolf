import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from './App';
import { makeStore } from './app/store';
import { startupSessionStorage } from './session/nativeStorage';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
const container = root;

// The seat is read before the first render, so a reopened APK lands back in its game (WW-1603).
async function start() {
  const store = makeStore({ storage: await startupSessionStorage() });
  createRoot(container).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void start();
