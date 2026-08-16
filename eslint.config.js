import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["app/vendor/**"],
  },
  js.configs.recommended,
  {
    files: ["app/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      eqeqeq: "error",
      "no-console": "warn",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
