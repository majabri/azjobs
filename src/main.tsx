// Sentry must be initialised before React renders so it captures
// all errors, including those thrown during component setup.
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import App from "./shell/App.tsx";
import "./index.css";
import "./theme.css";
import "./lib/i18n";

// ThemeProvider is mounted inside App.tsx (within AuthProvider).
// Do NOT wrap here — ThemeContext calls useAuth() and must live below AuthProvider.
createRoot(document.getElementById("root")!).render(<App />);
