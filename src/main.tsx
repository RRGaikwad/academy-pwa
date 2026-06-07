import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from './context/AppContext.tsx';
import "./index.css";
import App from "./App";

// VitePWA (via ./registerSW.js injected into index.html) handles service worker
// registration and auto-updates with skipWaiting + clientsClaim.
// We do NOT register manually here to avoid double-registration conflicts.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
