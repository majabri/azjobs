import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

export default defineConfig(({ mode }) => {
  // Validate required environment variables (skip in CI — no secrets needed for compilation)
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (mode === "production" && !process.env.CI) {
    if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is required");
    if (!supabaseKey) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required");
  }

  // Sentry source-map upload — only active when SENTRY_AUTH_TOKEN is set.
  // Set this in Vercel/GitHub Actions secrets for production builds.
  const sentryPlugin = process.env.SENTRY_AUTH_TOKEN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG ?? "jabri-solutions",
        project: process.env.SENTRY_PROJECT ?? "icareeros",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.VITE_APP_VERSION ?? "unknown",
        },
        sourcemaps: {
          filesToDeleteAfterUpload: ["dist/**/*.map"],
        },
      })
    : null;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), ...(sentryPlugin ? [sentryPlugin] : [])],
    // Emit source maps so Sentry can display readable stack traces
    build: {
      sourcemap: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
