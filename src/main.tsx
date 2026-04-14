import { createRoot } from "react-dom/client";
import App from "./shell/App.tsx";
import "./index.css";
import "./theme.css";
import "./lib/i18n";

// ThemeProvider is mounted inside App.tsx (within AuthProvider).
// Do NOT wrap here — ThemeContext calls useAuth() and must live below AuthProvider.
createRoot(document.getElementById("root")!).render(<App />);
