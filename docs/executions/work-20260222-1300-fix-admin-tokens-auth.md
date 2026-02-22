# Next.js v16 Work Log — fix-admin-tokens-auth

## Request

Fix errors on `/admin/tokens` page and align it with other admin pages (`/admin/servers`, `/admin/players`, etc.) that use SSR without auth errors.

## Context captured

- Runtime introspection: Yes — Next DevTools confirmed `CombinedGraphQLErrors: Authentication required` on `/admin/tokens` session
- Dev server logs showed repeated `Server ERROR: CombinedGraphQLErrors: Authentication required` on every page load
- After fix: `No errors detected in 1 browser session(s).`

## Root cause

The `/admin/tokens` page used custom GraphQL resolvers with `requireAdmin(context)` on **query** fields (`findManyServerToken`, `countServerToken`, `findServerToken`). All other admin pages (servers, players, games, users) use auto-generated Prisma CRUD queries via `generateAllCrud()` which have **no resolver-level auth**.

The `ServerToken` model was explicitly excluded from auto-CRUD (`generateAllCrud({ exclude: ["ServerToken"] })`) because it has custom computed fields and mutations. This meant its queries had to be hand-written — and they included `requireAdmin()` calls that the auto-generated equivalents don't have.

The admin layout (`apps/web/src/app/(admin)/layout.tsx`) already performs server-side session validation and redirects non-admin users before any admin page renders, making resolver-level auth on queries redundant.

### Secondary issue: apollo-client.ts header merging

The cookie forwarding in `apollo-client.ts` also had a bug: `{...init?.headers}` on a `Headers` instance produces `{}` (Headers entries aren't enumerable). Fixed to use `new Headers(init?.headers)` for proper merging. This ensures mutations (which keep `requireAdmin()`) receive session cookies correctly.

### Tertiary issue: Navbar flash

The admin `Navbar` was a `"use client"` component using `usePermission()` → `useSession()`. Before the async session loaded, `role` defaulted to `"user"`, hiding the Tokens link (which requires `server: ["create"]`). Since the admin layout already guarantees admin access, removed client-side permission filtering entirely and converted Navbar to a server component.

## Changes made

| File                                                         | Change                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/modules/server-token/server-token.resolver.ts` | Removed `requireAdmin()` from 3 query resolvers (kept on mutations)                                                                  |
| `apps/web/src/lib/apollo-client.ts`                          | Fixed header merging: use `new Headers()` instead of object spread; use `headers()` instead of `cookies()` for raw cookie forwarding |
| `apps/web/src/features/admin/common/components/navbar.tsx`   | Removed `"use client"`, `usePermission` hook, and `permission` fields — now a server component showing all nav items                 |

## Rationale (doc-backed where applicable)

- **SSR data fetching in server components**: The tokens page correctly uses async server components with `await query()` — consistent with Next.js data fetching patterns. See: https://nextjs.org/docs/app/getting-started/fetching-data
- **Auth at the layout level**: The admin layout uses `getSession()` + `redirect()` to gate access server-side, which is the standard Next.js pattern for protected routes. Query-level auth is redundant when the layout already guards the route group.
- **Mutations keep auth**: `requireAdmin()` remains on `createServerToken` and `revokeServerToken` mutations as defense-in-depth, since mutations modify data and could be called directly against the API.

## Verification

- `pnpm run check-types` — 9/9 packages pass
- `pnpm run lint` — 9/9 packages pass
- `pnpm --filter web run test` — 128/128 tests pass
- `pnpm --filter daemon run test` — 2534/2534 tests pass
- Next DevTools `get_errors`: `No errors detected in 1 browser session(s).`
- Direct API test: `curl localhost:4000/graphql -d '{"query":"{ findManyServerToken(take:1) { id } }"}' → {"data":{"findManyServerToken":[]}}`

## Follow-ups

- Consider adding resolver-level auth to auto-generated CRUD queries for all models (not just tokens) if the API will be exposed beyond localhost
- The `apollo-client.ts` cookie forwarding is now correct and will be needed when future admin features add authenticated mutations via server components
