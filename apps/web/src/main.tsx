import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from './App';
import { makeStore } from './app/store';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const store = makeStore();

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
