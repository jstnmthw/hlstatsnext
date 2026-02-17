# Next.js v16 Work Log — nextjs16-type-fixes

## Request

Fix type errors and lint warnings across the monorepo after upgrading to Next.js v16, Apollo Client v4, React 19.2, and Prisma v7. Also review and apply Next.js v15->v16 breaking changes including the `middleware.ts -> proxy.ts` rename.

## Context captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts: All admin pages (games, players, servers, users), public server pages, homepage
- Total errors before: 20 type errors, 0 lint errors
- Total errors after: 0 type errors, 0 lint errors

## Changes made

### 1. Migrated 5 GraphQL query files from untyped `gql` to typed `graphql()` codegen

Apollo Client v4 removed implicit `any` typing from `gql` tagged templates, causing query results to return `unknown` instead of inferred types. Migrated all query files to use the typed `graphql()` function from `@graphql-codegen/client-preset`.

Files:

- `src/features/admin/games/graphql/game-queries.ts`
- `src/features/admin/players/graphql/player-queries.ts`
- `src/features/admin/users/graphql/user-queries.ts`
- `src/features/admin/servers/graphql/server-queries.ts`
- `src/features/servers/graphql/servers-queries.tsx`

### 2. Removed `as DocumentNode` type casts from server actions

The casts were stripping TypedDocumentNode types, causing mutation results to be typed as `{}`.

Files:

- `src/features/admin/servers/actions/create-server.ts`
- `src/features/admin/servers/actions/update-server.ts`

### 3. Fixed `data` possibly undefined errors

Apollo Client v4's `query()` returns `data` as `T | undefined`. Added optional chaining (`data?.`) in all page components.

Files:

- `src/app/admin/games/page.tsx`
- `src/app/admin/players/page.tsx`
- `src/app/admin/servers/page.tsx`
- `src/app/admin/servers/add/page.tsx`
- `src/app/admin/servers/[id]/edit/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/servers/[id]/page.tsx`
- `src/features/games/components/game-list.tsx`
- `src/features/homepage/components/server-list.tsx`

### 4. Updated column type definitions to match GraphQL codegen types

Replaced Prisma-based `Pick<Player, ...>` and `Pick<User, ...>` types with standalone interfaces matching codegen output. Fixed `playerId: number` vs `string` mismatch, `email: string | null` vs `string | null | undefined`, and `Date` vs `string | Date` for DateTime fields.

Files:

- `src/features/admin/players/components/player-columns.tsx`
- `src/features/admin/users/components/user-columns.tsx`

### 5. Fixed `prepareCreateServerInput` type safety

Replaced `Object.fromEntries()` pattern (which returns `{ [k: string]: ... }`) with a properly typed return using `CreateServerInput` from codegen. Removed phantom `mod` field that wasn't part of the GraphQL schema.

Files:

- `src/features/admin/servers/utils/server-transformers.ts`

### 6. Fixed `serverId` string-to-number conversion

Codegen returns `serverId` as `string` (GraphQL ID). Added `Number()` conversion where the form component expects `number`.

Files:

- `src/app/admin/servers/[id]/edit/page.tsx`

### 7. Removed unnecessary Prisma type imports

Removed `Server` import from `@repo/db/client` in `server-list.tsx` and `Player`/`User` imports from column files, since codegen types now provide proper typing.

Files:

- `src/features/homepage/components/server-list.tsx`
- `src/features/admin/players/components/player-columns.tsx`
- `src/features/admin/users/components/user-columns.tsx`

### 8. Applied Next.js v16 migration changes

- Removed `--turbopack` flag from dev script (now default in v16)
- Converted `next.config.js` to `next.config.ts` for type safety
- No `middleware.ts` existed, so no `proxy.ts` rename needed
- Verified async request APIs (`params`, `searchParams`) are properly `await`ed
- Verified `next/navigation` is used (not deprecated `next/router`)

Files:

- `apps/web/package.json`
- `apps/web/next.config.ts` (new, replacing `next.config.js`)

## Rationale (doc-backed where applicable)

- **`middleware` -> `proxy` rename**: Per Next.js v16 upgrade guide, "The middleware filename is deprecated, and has been renamed to proxy." No middleware existed in this codebase so no action needed.
  - URL: https://nextjs.org/docs/app/guides/upgrading/version-16
- **`--turbopack` flag removal**: "Starting with Next.js 16, Turbopack is stable and used by default with next dev and next build [...] This is no longer necessary."
  - URL: https://nextjs.org/docs/app/guides/upgrading/version-16
- **Async request APIs**: "Starting with Next.js 16, synchronous access is fully removed. These APIs can only be accessed asynchronously." Already properly implemented in this codebase.
  - URL: https://nextjs.org/docs/app/guides/upgrading/version-16
- **`next.config.ts`**: TypeScript config is now the recommended approach per Next.js v16 docs.
  - URL: https://nextjs.org/docs/app/api-reference/config/next-config-js
- **Typed GraphQL codegen**: Using `graphql()` from `@graphql-codegen/client-preset` provides TypedDocumentNode which gives end-to-end type safety from query definition through to data access.

## Verification

- `pnpm run check-types` - 7/7 packages pass (0 errors)
- `pnpm run lint` - 7/7 packages pass (0 errors, 0 warnings)

## Follow-ups

- **Add `mod` to `CreateServerInput` schema**: The `mod` field was being silently passed through via untyped code but isn't part of the GraphQL schema. If mod selection during server creation is needed, the API schema should be updated.
- **Consider adding `error.tsx` / `loading.tsx`**: No error boundaries or loading states exist in the route segments.
- **GraphQL DateTime scalar typing**: The codegen maps `DateTime` to `any`. Consider configuring scalar types in `codegen.ts` for stricter typing: `scalars: { DateTime: "string" }`.
- **Run `next build`**: Recommended to verify production build succeeds with all changes.
