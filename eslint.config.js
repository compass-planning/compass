// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";

export default [
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      // shadcn/ui auto-generated components — do not lint
      "client/src/components/ui/**",
      // Orphan root-level files — delete these, but ignore in the meantime
      "FinancialPlanning.tsx",
      "ModuleViews_online.tsx",
      "reports_addition.ts",
      // Root config files that use Node APIs
      "drizzle.config.ts",
      "**/*.cjs",
      // Debug/fix scripts
      "check*.mjs",
      "fix*.mjs",
      "create*.mjs",
      "drop*.mjs",
      "reset*.mjs",
      "test*.mjs",
      "full*.mjs",
      "add*.mjs",
      "scripts/**",
      "**/*.bak",
      "**/*.backup",
    ],
  },

  // ── Base JS recommended ─────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript — all .ts and .tsx files ─────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": ["warn", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": "off",

      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "warn",
      "prefer-const": "warn",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "no-undef": "off",
      "no-redeclare": "off",
    },
  },

  // ── Client (browser) files ───────────────────────────────────────────────────
  {
    files: ["client/src/**/*.tsx", "client/src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "react-refresh": reactRefreshPlugin,
    
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,

      // ── Only the two hooks rules we actually want ──────────────────────────
      // We intentionally do NOT spread reactHooksPlugin.configs.recommended
      // because react-hooks v5 bundles experimental React Compiler rules that
      // fire false positives on valid patterns (setState in effects, Date.now
      // in initialisers, etc). We only opt in to the two stable rules.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",  // cosmetic only, not a runtime risk
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true,
      }],

      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],
    },
  },

  // ── Server files (Node.js) ───────────────────────────────────────────────────
  {
    files: ["server/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
