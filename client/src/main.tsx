import React from 'react';
import ReactDOM from 'react-dom/client';
import { openUrl } from '@tauri-apps/plugin-opener';
import { App } from './App';
import './styles.css';

// Route external links through the OS browser — Tauri's webview doesn't
// natively follow target="_blank", so we intercept and hand off to the
// opener plugin instead.
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return;
  const url = anchor.getAttribute('href') || '';
  if (/^https?:\/\//i.test(url)) {
    e.preventDefault();
    void openUrl(url).catch(() => {
      /* no-op */
    });
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
