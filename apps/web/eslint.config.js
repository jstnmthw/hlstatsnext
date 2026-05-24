import { nextJsConfig } from "@repo/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // Public routes (and shared homepage components) must not import from
    // features/admin/** — admin queries may select sensitive fields (e.g.
    // Player.email for the admin column) that would otherwise leak into
    // the public RSC payload served to every visitor.
    files: ["src/app/(public)/**/*", "src/features/homepage/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/admin/*", "**/features/admin/*"],
              message:
                "Public routes must not import from features/admin/*. Admin operations may select sensitive fields. Use features/<domain>/graphql instead.",
            },
          ],
        },
      ],
    },
  },
]
