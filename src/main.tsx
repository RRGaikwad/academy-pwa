import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from './context/AppContext.tsx';
import "./index.css";
import App from "./App";

// Force the browser to aggressively check for a new Service Worker on every load.
// This ensures that Installed PWAs (which don't have a refresh button) will break
// out of any broken cache states as soon as the app is opened.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
      registration.update().catch(() => {});
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
