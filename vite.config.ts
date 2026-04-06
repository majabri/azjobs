import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Fail loudly if required env vars are missing (Task 1.1 + Task 2.1)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is required");
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseKey) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
          host: "::",
          port: 8080,
          hmr: {
                  overlay: false,
          },
    },
    plugins: [react()],
    define: {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
    },
    resolve: {
          alias: {
                  "@": path.resolve(__dirname, "./src"),
          },
    },
}));
