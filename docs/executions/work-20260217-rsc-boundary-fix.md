# Next.js v16 Work Log — rsc-boundary-fix

## Request

Fix runtime error: "Functions cannot be passed directly to Client Components" on admin table pages after DataTable refactor.

## Context captured

- Runtime introspection: Yes — `nextjs_call get_errors` confirmed the error on `/admin/servers` session
- Affected routes: `/admin/servers`, `/admin/players`, `/admin/games`, `/admin/users`

## Changes made

**Root cause:** The DataTable refactor removed `"use client"` wrapper components and had Server Component pages directly calling column factory functions (`serverColumns()`, etc.) and passing the resulting objects — which contain `header` and `cell` render functions — as props to the `<DataTable>` Client Component. Functions are not serializable across the RSC boundary.

**Fix:** Re-introduced thin `"use client"` wrapper components that receive only serializable props (`data` array + `totalCount` number) and create columns internally within the client boundary. These are dramatically simpler than the old wrappers (no `useDataTableUrl` calls, no callback threading, no state management — just 2 props).

### Files touched

- `features/admin/servers/components/admin-servers-table.tsx` — **Re-created** (thin client wrapper, ~20 lines)
- `features/admin/players/components/admin-players-table.tsx` — **Re-created** (thin client wrapper, ~20 lines)
- `features/admin/games/components/admin-games-table.tsx` — **Re-created** (thin client wrapper, ~20 lines)
- `features/admin/users/components/admin-users-table.tsx` — **Re-created** (thin client wrapper, ~20 lines)
- `app/(admin)/admin/servers/page.tsx` — Updated to use `<AdminServersTable data={...} totalCount={...} />`
- `app/(admin)/admin/players/page.tsx` — Updated similarly
- `app/(admin)/admin/games/page.tsx` — Updated similarly
- `app/(admin)/admin/users/page.tsx` — Updated similarly

## Rationale (doc-backed where applicable)

- "Props passed to Client Components need to be serializable by React." — [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- The standard pattern is Server Component (data fetching) → Client Component (interactivity). Column definitions contain functions, so they must be created within the client boundary.

## Verification

- `pnpm --filter web run check-types` — passed
- `pnpm --filter web run lint` — passed (0 warnings)
- `nextjs_call get_errors` — "No errors detected in 2 browser session(s)."

## Follow-ups

- None. The fix is minimal and correct.
