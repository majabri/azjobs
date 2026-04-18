import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Focus coverage on the utility/service layers that have tests;
      // UI hooks and Supabase-dependent services are excluded until
      // integration test infrastructure is set up in Phase 4.
      include: [
        "src/lib/platform/**/*.ts",
        "src/lib/job-search/**/*.ts",
        "src/lib/normalizeError.ts",
        "src/lib/routes.ts",
        "src/lib/utils.ts",
        "src/lib/analysisEngine.ts",
        "src/services/job/service.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test/**",
        "src/integrations/**",
        "src/lib/logger.ts",
        // Barrel re-export files (no logic to cover)
        "src/lib/job-search/index.ts",
        "src/lib/platform/index.ts",
        // Supabase-dependent — cannot unit test without full DB integration
        "src/lib/job-search/saveJob.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
