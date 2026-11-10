import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/tailwind.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('Offline app-shell caching could not be enabled:', error);
    });
  });
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
