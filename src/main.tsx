import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { canonicalSearch } from './state/url';

// Old view names (?cam=bank|aerial) and gated dev views: show the URL the app actually loaded (spec 6a §4.1).
const fixed = canonicalSearch(window.location.search);
if (fixed !== null) window.history.replaceState(null, '', fixed + window.location.hash);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
