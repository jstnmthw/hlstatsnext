# Next.js v16 Work Log — players-page-refactor

## Request

Refactor the public `/players` page to be a 1-to-1 clone of the `/servers` page with player content and relevant search options (player name, with steam ID noted as a follow-up).

## Context captured

- Runtime introspection: Yes (dev server on port 3000 discovered)
- Affected routes: `/(public)/players` (index page)
- Pattern source: `/(public)/servers` page + `features/servers/` feature directory

## Changes made

### New files

- `src/features/players/components/player-config.ts` — `PublicPlayerItem` type + `playerPageTableConfig` (no `"use client"` — safe for Server Component import per project pattern)
- `src/features/players/components/player-columns.tsx` — column definitions: rank (page-aware), player name (link), skill, kills, deaths, K/D (computed), country
- `src/features/players/components/players-table.tsx` — client wrapper `<PlayersTable>` using shared `<DataTable>`

### Modified files

- `src/features/admin/players/graphql/player-queries.ts` — added `country` and `flag` to `GET_PLAYERS_WITH_PAGINATION` selection set
- `src/app/(public)/players/page.tsx` — replaced mock-data implementation with real server component: async params, `parseUrlParams`, `buildPaginationVariables`, two parallel `query()` calls, `<PlayersTable>` render

## Rationale

- Config/type split into a no-directive file avoids the Server Component / `"use client"` import proxy issue documented in project memory. Same pattern as `features/servers/components/server-config.ts`.
- Server Component page with two Apollo `query()` calls (data + count) matches the servers page exactly.
- Rank column computes global rank as `pageIndex * pageSize + rowIndex + 1` using TanStack Table's `table.getState().pagination`, giving accurate position across pages.
- Default sort: `skill desc` (players ranked by skill, highest first) — more meaningful than alphabetical.

## Verification

```
pnpm run codegen       ✓  (GQL types regenerated cleanly)
pnpm --filter web run check-types  ✓  (zero type errors)
pnpm --filter web run lint         ✓  (zero warnings)
```

## Follow-ups

- **Steam ID search**: `PlayerUniqueId` is a related table (`uniqueIds` relation). Searching by Steam ID requires a `{ uniqueIds: { some: { uniqueId: { contains: value } } } }` where clause. The current `buildWhereClause` utility only supports flat field paths in the `OR` array. Extending it or adding a `filterTransform` for the steam ID would unlock this.
- `/players/[id]` page still uses mock data — needs the same real-data treatment.
