import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default /** @type {import("eslint").Linter.Config[]} */ ([
  {
    ignores: [
      "agent-os/**",
      "workspaces/**",
      "worktrees/**",
      ".claude/**",
      "supabase/migrations/**",
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.config.*",
      "prettier.config.cjs",
      "next-env.d.ts",
      "package-lock.json"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"]
]);
