import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/context/ThemeContext";
import "./theme.css";
import App from "./shell/App.tsx";
import "./index.css";
import "./lib/i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
