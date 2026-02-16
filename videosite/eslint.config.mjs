import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "nginx/**",
      "frontend/build/**",
      "backend/dist/**"
    ]
  },
  {
    files: ["frontend/**/*.{js,jsx,mjs}"],
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      ...(pluginReact.configs.flat.recommended.rules ?? {}),
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off"
    }
  },
  {
    files: ["backend/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.node }
  },
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] }
]);