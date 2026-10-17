import { nextJsConfig } from "@repo/eslint-config/next-js"

// Only src/lib/data/** talks to the API. Everything else reads through a data
// module, which guards the request and returns a DTO.
const apolloClientOutsideDataModules = {
  group: ["@/lib/apollo-client", "**/lib/apollo-client"],
  message:
    "Import a function from src/lib/data/<domain>.ts instead. Data modules guard the request and own the Apollo client.",
}

// Public routes (and shared homepage components) must not import from
// features/admin/** — admin queries may select sensitive fields (e.g.
// Player.email for the admin column) that would otherwise leak into
// the public RSC payload served to every visitor.
const adminFeaturesFromPublicRoutes = {
  group: ["@/features/admin/*", "**/features/admin/*"],
  message:
    "Public routes must not import from features/admin/*. Admin operations may select sensitive fields. Use src/lib/data/public/<domain>.ts instead.",
}

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/data/**", "src/lib/apollo-wrapper.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [apolloClientOutsideDataModules] }],
    },
  },
  {
    files: ["src/app/(public)/**/*", "src/features/homepage/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [apolloClientOutsideDataModules, adminFeaturesFromPublicRoutes] },
      ],
    },
  },
]
