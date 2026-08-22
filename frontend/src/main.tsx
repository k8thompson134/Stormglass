import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Register service worker. Dev mode (vite-plugin-pwa's `devOptions.enabled`, added
// for local push-notification testing) serves an unbundled worker at a different
// virtual path and needs `type: 'module'`; production serves the real compiled
// worker at /sw.js.
if ("serviceWorker" in navigator) {
  const swUrl = import.meta.env.DEV ? "/dev-sw.js?dev-sw" : "/sw.js";
  navigator.serviceWorker
    .register(swUrl, import.meta.env.DEV ? { type: "module" } : undefined)
    .then((registration) => {
      if (import.meta.env.DEV)
        console.log("Service Worker registered:", registration);
    })
    .catch((error) => {
      if (import.meta.env.DEV)
        console.error("Service Worker registration failed:", error);
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
