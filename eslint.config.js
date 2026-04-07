import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off", // TODO: Phase 5 — re-enable and fix
      "no-useless-escape": "warn", // TODO: Phase 5 — fix regex escapes in Lovable code
      "no-empty": "warn", // TODO: Phase 5 — add proper error handling to catch blocks
      "@typescript-eslint/no-empty-object-type": "off", // TODO: Phase 5 — fix empty interfaces in UI components
      "prefer-const": "warn", // TODO: Phase 5 — fix let→const in Lovable code
      "@typescript-eslint/no-unused-expressions": "off", // TODO: Phase 5 — fix expression statements
      "no-extra-boolean-cast": "warn", // TODO: Phase 5 — remove redundant Boolean() calls
      "@typescript-eslint/no-require-imports": "off", // TODO: Phase 5 — convert require() to import
      "@typescript-eslint/ban-ts-comment": "off", // TODO: Phase 5 — replace @ts-ignore with @ts-expect-error
    },
  },
);
