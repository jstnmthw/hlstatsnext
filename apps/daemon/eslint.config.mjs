import { config } from "@repo/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]
