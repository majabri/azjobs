import { createRoot } from "react-dom/client";
import App from "./shell/App.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";
import "./theme.css";
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
