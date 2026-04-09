import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    define: {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
                  process.env.VITE_SUPABASE_URL || "https://gberhsbddthwkjimsqig.supabase.co"
          ),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
                  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZXJoc2JkZHRod2tqaW1zcWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODYyMzUsImV4cCI6MjA4NzI2MjIzNX0.t9FE9ku4rgzymhuAJi4Y7qGcwc3IqP0fon3HKAtWC14"
          ),
    },
    server: {
          host: "::",
          port: 8080,
          hmr: {
                  overlay: false,
          },
    },
    plugins: [react()],
    resolve: {
          alias: {
                  "@": path.resolve(__dirname, "./src"),
          },
    },
}));
