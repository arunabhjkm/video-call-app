import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { Buffer } from 'buffer'

// Manual polyfills for simple-peer on mobile/Vite
import * as process from "process";
window.global = window;
window.process = process;
window.Buffer = Buffer;

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
