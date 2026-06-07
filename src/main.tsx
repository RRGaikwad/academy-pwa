import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from './context/AppContext.tsx';
import "./index.css";
import App from "./App";

// Forcefully unregister any stuck/stale Service Workers from previous PWA versions
// that might be intercepting and hanging Supabase Auth requests.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then(
        (boolean) => console.log('Successfully unregistered stale service worker:', boolean)
      ).catch(
        (error) => console.error('Error unregistering stale service worker:', error)
      );
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
