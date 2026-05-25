# Quality Report — hlstatsnext.com (full scan)

_Scanned: `apps/api/src/`, `apps/daemon/src/`, `apps/web/src/`, `packages/*/src/`_
_Date: 2026-05-24_

## Summary

Overall structural health is good. The API surface, packages, and frontend pages are clean, well-layered, and largely free of god files. The frontend's biggest issue is repeated table/column scaffolding across five admin features — the kind of duplication that is mechanical to fix and yields immediate readability wins. The daemon carries the heaviest weight: four sibling files at 700–977 lines (`cs.parser`, `player.repository`, `rcon-schedule.service`, `consumer`) each combine multiple responsibilities and are the highest-impact refactor targets in the codebase. One bright spot to call out: the Pothos exclusion-list model (`pothos-schema.ts`) and the per-domain custom object files are exemplary — the security perimeter is explicit, runtime-checked, and self-documenting.

## High Priority

Issues where refactoring would most improve readability or reduce risk.

- [x] **`apps/daemon/src/modules/ingress/parsers/cs.parser.ts:1-929`** — God parser combining regex extraction, state mutation, and event assembly across 15 strategies.
      **Problem:** Single class owns the per-game parsing strategy table, regex/timestamp/event-id assembly, and `ServerStateManager` mutations. `parseLine()` (≈99–125) nests 3+ levels; each `parseXxxEvent()` mixes pure parsing with side effects on shared state.
      **Evidence:** 929-line file. `parseKillEvent`, `parseDamageEvent`, `parseSuicideEvent` repeat regex→timestamp→state→event assembly. Constructor takes `ServerStateManager` and mutates it inside `updateMap`, `startRound`, etc.
      **Suggested split:** `ParserStrategyTable` (line → handler), `EventAssemblyHelper` (timestamp + id + base shape), `StateCoordinator` (the only place state is mutated). Keep `CsParser` as a thin orchestrator.
      **Risk:** Low — extracted pieces are pure; behavior-preserving if covered by unit tests on each strategy first.

- [x] **`apps/daemon/src/modules/player/repositories/player.repository.ts:1-977`** — Repository mixing data access, batching, name tracking, ranks, and event logging across 30+ methods.
      **Problem:** Single class spans player hydration, stat mutation, event-frag logging, name upserts, rank/session queries. `executeWithTransaction` wrapper boilerplate repeats across ~15 methods.
      **Evidence:** Methods `upsertPlayer`, `batchUpsertPlayers`, `logEventFrag`, `updatePlayerName`, `getPlayerRank`, `getPlayerSessionStats` all share one class. Lines ~200–300 show repeated transaction-wrapper boilerplate.
      **Suggested split:** `PlayerStatisticsRepository` (kills/deaths/skill/streaks), `PlayerNameRepository` (name upserts + name-keyed stats), `PlayerRankRepository` (rank + count queries). Keep `PlayerRepository` as façade or wire callers directly.
      **Risk:** Medium — batch coordination needs care. Start with read-only methods.

- [x] **`apps/daemon/src/modules/rcon/schedulers/rcon-schedule.service.ts:1-728`** — Cron scheduler + state machine + retry + concurrency + filtering all in one class.
      **Problem:** Long methods, three parallel state maps (`jobs`, `executors`, `serverExecutions`), and inline server-filtering / concurrency / retry logic. `executeScheduleForServers` (407–458, 51 lines), `executeOnServer` (463–527, 65 lines), `shouldExecuteOnServer` (533–560).
      **Suggested split:** `ScheduleExecutor` (single-execution retry + cleanup + metrics), `ServerFilterResolver` (filter evaluation), `ConcurrencyLimiter` (the three exec-tracking calls). Keep `RconScheduleService` as orchestrator. Encapsulate the manual `updateJobStats` + `addToHistory` + hardcoded 100-item cap in a `ScheduleJobStats` value object.
      **Risk:** Medium — state transitions are subtle; cover retry scenarios with integration tests before extracting.

- [x] **`apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:1-734`** — Consumer entangling connection lifecycle, message dispatch, retry/backoff, DLQ routing, and metrics.
      **Problem:** Overlapping state flags (`isConsuming`, `isPaused`, `inflight`, `pendingTimers`); `handleMessage` (~300–370) chains validate → process → ack/nack/dlq → retry inside nested try/catch; metrics recording is interleaved with control flow.
      **Suggested split:** `MessageRetryOrchestrator` (delay + timer + DLQ decision), `ConsumerMetricsCollector` (all `metrics.*` calls), `MessageValidator` (shape + error classification). Keep `EventConsumer` as the lifecycle state machine.
      **Risk:** High — reconnect + inflight handling is fragile and load-bearing. Extract one piece at a time behind tests; resubscribe semantics must be preserved.

- [x] **`packages/ui/src/components/preview.tsx:1-1325`** — 1325-line demo/showcase file living in the published component library.
      **Problem:** Pure demo content (50+ component showcases, repeated `<Example>` blocks) sits inside `@repo/ui`. Bloats the library and couples implementation to documentation.
      **Suggested split:** Move to a separate `@repo/ui-storybook` (or `apps/web` storybook route), or mark internal and exclude from the package's public surface. Either way, do not ship demo code from the design-system package.
      **Risk:** Low — check `packages/ui/src/index.ts` first; if not exported, this is a pure file move. If exported, that's a breaking `@repo/ui` API change for any consumer importing it (unlikely).

- [x] **`packages/ui/src/lib/color-variants.ts:54-603`** — ~550 lines of near-identical color-scheme variant blocks repeated 21 times.
      **Problem:** Each color (zinc, green, blue, …) redefines the same 3 variant structures (solid/outline/ghost) with only the Tailwind color name changing. Classic copy-paste duplication.
      **Resolved:** Introduced `makeVariants(solid, outline)` helper that derives `ghost = { ...outline, border: "border-transparent" }` (an invariant that holds for every color), plus shared `AFTER_SATURATED`/`AFTER_LIGHT` constants for the repeated pseudo-element overlays. 640 → 544 lines (~25% reduction). Aggressive template-literal generation (the audit's "~50 line" target) was **rejected** because Tailwind v4's source scanner only detects classes that appear as literal strings — `\`bg-${color}-${shade}\`` would silently drop classes from the build. Comment in the file documents this constraint.

- [x] **`apps/web/src/features/admin/{users,servers,tokens,games,players}/components/*-columns.tsx`** — Five sibling files duplicating `ActionsHeader`, the selection-checkbox column, and status-badge logic.
      **Problem:** `ActionsHeader` is reimplemented in user-columns (57–86), server-columns (57–72), and token-columns (35–50). The checkbox column appears nearly verbatim in user-columns (76–175), server-columns (77–100), token-columns (84–107). Status-badge rendering is duplicated between `getStatusBadge` (token-columns 52–79) and inline JSX in user-columns (97–147).
      **Suggested split:** Extract `apps/web/src/features/common/data-table/actions-header.tsx`, `createSelectColumn<T>()`, and a `<StatusBadge variant="…" />` (or `getStatusBadgeConfig`) helper. Then thin each `*-columns.tsx` file down to the domain-specific cells.
      **Risk:** Low — pure extraction across already-similar files; one PR per file keeps diffs small.

- [x] **`apps/web/src/features/admin/tokens/components/token-columns.tsx:171-232`** — `TokenActions` is a 60-line stateful component defined inline inside the columns array.
      **Problem:** Cell renderer mixes `useRouter`, `useTransition`, dropdown menu, nested AlertDialog, and async mutation handling inside a closure in a column config. Pattern is already extracted in `user-row-actions.tsx` — token-columns just didn't follow suit.
      **Suggested split:** Move to `apps/web/src/features/admin/tokens/components/token-row-actions.tsx`, mirroring `user-row-actions.tsx`.
      **Risk:** Low — mechanical extraction.

## Medium Priority

Worth doing, not urgent.

- [ ] **`apps/api/src/modules/server/server.resolver.ts:73-185`** — `updateServerWithConfig` and `createServerWithConfig` share ~100 lines of identical `requireAdmin` + try/catch + `rconPassword` stripping + result shaping.
      **Suggested:** Extract a `runServerMutation(handler, transformResult)` helper and a `stripRconPassword(server)` mapper. Reduces both mutations to their domain logic.
      **Risk:** Low.

- [ ] **`apps/api/src/modules/server/server.resolver.ts:86-101, 146-157`** — Two mutations build GraphQL input → service input via slightly different conventions (`!== null && !== undefined` vs `|| undefined`).
      **Suggested:** Single `buildUpdateServerInput` / `buildCreateServerInput` helper. Picks one null/undefined convention.
      **Risk:** Low.

- [ ] **`apps/api/src/modules/player/player.repository.ts:23-100, 158-177`** — `getServerPlayers` and `getServerPlayersCount` build near-identical `where` clauses inline; the `onlineOnly` branch mutates `whereClause.AND` and is not mirrored in the count query.
      **Suggested:** Extract `buildServerPlayerWhereClause(filters, serverId, { onlineOnly })`. Removes the AND-is-array invariant check.
      **Risk:** Low — pure transformation.

- [ ] **`apps/api/src/modules/player/{player.resolver.ts:82-102, player.service.ts:81-102}`** — `rank` and `accuracyPercentage` are computed in field resolvers while sibling derived fields (`kdRatio`, `headshotRatio`) are computed in the service. Split is inconsistent and rank/accuracy aren't on the `PlayerServerStats` interface.
      **Suggested:** Move rank + accuracy computation into the service alongside kd/headshot; add them to `PlayerServerStats`; drop the field resolvers.
      **Risk:** Low–Medium — deterministic logic; centralising makes it testable.

- [ ] **`apps/api/src/modules/{server,player,auth}/*.service.ts`** — Service error handling is inconsistent: some methods swallow + return null (`getRconPassword`), some return `{ success, message }` (`testRconConnection`), some throw via `handlePrismaError` (player service), some throw raw (auth service).
      **Suggested:** Pick one boundary: either services throw GraphQL-shaped errors that resolvers catch, or all return `Result<T, E>`. Document in `apps/api/src/CLAUDE.md` or a short comment in the builder.
      **Risk:** Medium — touches multiple call sites; do as one sweep.

- [ ] **`apps/daemon/src/modules/player/handlers/kill-event.handler.ts:171-209`** (and sibling suicide/damage handlers) — Each handler re-assembles `SkillRating` objects with the same default constants before calling `rankingService`.
      **Suggested:** `PlayerService.prepareSkillRatings(killerId, victimId)` or a tiny `SkillRatingBuilder`. Removes copy-paste defaults across handlers.
      **Risk:** Low.

- [ ] **`apps/daemon/src/modules/ingress/ingress.service.ts:19-295`** — Service owns UDP server, beacon auth, event publishing, and an implicit parser cache with no eviction policy. Parser selection (`getOrCreateParserForServer`, 281–294) is inline.
      **Suggested:** Extract `ParserSelector` (game fetch + instantiation + cache). `IngressService` calls `parserSelector.getParserForServer(serverId)`.
      **Risk:** Low.

- [ ] **`apps/daemon/src/modules/server/state/server-state-manager.ts:74-368`** — `serverStates` map is unbounded; `cleanupInactiveStates` is opt-in. If never wired, stale state grows forever.
      **Suggested:** Auto-start periodic cleanup from the constructor with configurable interval, add a configurable max size with LRU eviction, expose a Prometheus gauge for map size. (Structural — defensive bounding, not a leak fix.)
      **Risk:** Low.

- [ ] **`apps/web/src/features/admin/users/components/user-row-actions.tsx:30-33`** (+ `ban-user-dialog.tsx`) — Four parallel boolean dialog-open states (`editOpen`, `roleOpen`, `banOpen`, `deleteOpen`); each dialog manages its own form state separately.
      **Suggested:** Single discriminated-union state (`type ActiveAction = { kind: "edit" | "role" | "ban" | "delete"; user } | null`) and a `useUserAction` hook. Removes the boolean soup; only one dialog can be open at a time anyway.
      **Risk:** Medium — touches four dialogs; do behind tests.

- [ ] **`apps/web/src/features/admin/users/components/ban-user-dialog.tsx:101-215`** — Ban-mode and unban-mode share one component via large conditional branches; state fields (`reason`, `customReason`, `duration`, `customDays`) are only valid in ban mode.
      **Suggested:** Split into `BanUserDialog` and `UnbanUserDialog`. Move `BAN_REASONS` + `BAN_DURATIONS` (36–51) to `features/admin/users/lib/ban-config.ts`.
      **Risk:** Low.

- [ ] **`apps/web/src/features/common/components/data-table.tsx:63-137`** — Frozen-column sticky-position math (cumulative widths, array reversals, `useLayoutEffect`) lives inside the rendering component.
      **Suggested:** Extract `useFrozenColumnStyles(columns)` hook. Brings the table file from 234 lines to ~140 without behaviour change.
      **Risk:** Low.

- [ ] **`apps/web/src/features/common/hooks/use-data-table-url.ts:45-135`** — Five near-identical handlers (`handleSort`, `handlePageChange`, `handleSearch`, …) each wrap a `pushState` with a small state delta.
      **Suggested:** Collapse into one `updateTableState(partial)` dispatcher. Shrinks the hook's surface from 11 returned values to a smaller, more discoverable API.
      **Risk:** Low.

- [ ] **`apps/web/src/features/auth/components/{login,register,forgot-password,reset-password,verify-email}-form.tsx`** — Five forms repeat the same `useState(error)` + `useState(loading)` + identical error display block.
      **Suggested:** `useAuthForm()` hook (or a thin `<AuthForm>` wrapper) that owns error/loading state and the standardised error-display div. Five forms then own only their fields + submit handler.
      **Risk:** Medium — exercise every auth flow after.

- [ ] **`packages/observability/src/prometheus/prometheus-metrics-exporter.ts:265-298`** — Metric storage uses a composite string key (`name{label="value",…}`) that must then be parsed back via `split("=")` + manual quote stripping.
      **Problem:** Round-tripping label values through a string is fragile (no escaping for quotes or commas) and forces parsing logic that wouldn't otherwise exist.
      **Suggested:** Store as `Map<metricName, Map<labelsObject, value>>` (or use a stable JSON-stringified-labels key on the inner map). Drops `parseMetricKey` entirely.
      **Risk:** Medium — internal to observability; verify scrape output is byte-identical before/after.

- [ ] **`packages/auth/src/permissions.ts:4-30`** — `statement` and `adminRole` both list the same resource → actions table.
      **Suggested:** Derive `adminRole` from `statement` (`ac.newRole(statement)` or equivalent) so adding a resource means editing one place.
      **Risk:** Low.

- [ ] **`packages/ui/src/components/ip-address.tsx:77-191`** — `IPAddress` and `Port` reimplement the same display-state + hidden-form-input pattern.
      **Suggested:** Extract `useFormattedInput()` hook or a `<FormattedInput format={…} />` primitive.
      **Risk:** Low.

## Low Priority / Cosmetic

Small wins, address opportunistically.

- [ ] `apps/api/src/modules/player/player.service.ts:22, 238-269` — Inline `{ take?: number; skip?: number }` and `sortField: string` should be a named `PaginationParams` and a `PlayerSortField` literal union.
- [ ] `apps/daemon/src/**/event-processor.ts:151` and various handlers — Weak names (`data`, `result`, `tmp`, `handler.handler`). Use domain-specific names; destructure for clarity.
- [ ] `apps/web/src/features/admin/{users,tokens,servers}/components/*-columns.tsx` — Inline 1–5 line helpers (`getInitials`, `getStatusBadge`, `isOnline`) belong in `features/{domain}/utils/`.
- [ ] `apps/web/src/features/common/components/form.tsx:28-29` — `ErrorDisplay` shows only the first server-action error; field-level errors are wired manually per form. Extend `FormField` to accept and render an error prop, or add a `useFormErrors` aggregator.
- [ ] `apps/web/src/features/common/graphql/pagination.ts:33` + `apps/web/src/app/(admin)/admin/servers/page.tsx:29-45` — `FilterTransform` convention has no canonical home; one feature uses `features/admin/users/lib/user-filters.ts`, others inline. Pick one and document in the pagination file.
- [ ] `apps/web/src/lib/datetime-util.ts:61-153` — Seven overlapping date formatters (`formatDate`, `formatHumanFriendlyDate`, `formatDateWithContext`, `formatDateRange`, `isRecentDate`, `formatDuration`). Consolidate or add JSDoc explaining "use this one for X".
- [ ] `apps/web/src/features/admin/servers/components/server-{create,edit}-form.tsx` — ~70% of fields overlap; consider a `mode: "create" | "edit"` prop on a single `ServerForm`. Medium-risk; defer unless edited often.
- [ ] `apps/web/src/features/ui-kit/components/kitchen-sink-content.tsx` — 1280-line demo; split per section (typography/colors/buttons/...) the next time it's edited.
- [ ] `packages/ui/src/components/field.tsx:52-71` — `fieldVariants` chains many container queries / `has-[…]` selectors. Works; consider whether some belong in plain CSS.
- [ ] `packages/crypto/src/encryption.ts:192-206` — Static `generateEncryptionKey` / `isValidEncryptionKey` would read more naturally as standalone exports.
- [ ] `packages/db/src/seeders/fake/logger.ts` — Pure-console + ANSI-color helper trapped in a seeder. If ever needed outside, extract to a small shared logger. Defer.

## Patterns to address across the codebase

These are systemic — fix once, benefit everywhere. Tackling each as a single coordinated change is cheaper than file-by-file.

- [ ] **Admin table scaffolding duplication (web).** Five `*-columns.tsx` files repeat `ActionsHeader`, the selection-checkbox column, and status-badge rendering. Extract to `features/common/data-table/{actions-header,select-column,status-badge}.tsx` and migrate all five together.
- [ ] **Mutation resolver boilerplate (api).** `requireAdmin(ctx)` + try/catch + result-shape mapping recurs in every admin mutation. A `runAdminMutation(handler)` wrapper plus a sensitive-field stripper helper would compress server/user/token mutations significantly.
- [ ] **Service error-handling contract (api).** Standardise on either "throw GraphQL errors" or "return `Result<T,E>`" across services. Today resolvers can't tell which pattern a given service method uses.
- [ ] **Daemon repository + handler boilerplate.** The `executeWithTransaction` wrapper and SkillRating assembly repeat across many methods/handlers. Encapsulate as a base-class helper (`this.inTransaction(fn)`) and a domain builder.
- [ ] **`*-form.tsx` shape (web).** Auth forms, server create/edit, ban dialog all reinvent error + loading + submit scaffolding. A small `useFormAction` hook would standardise the contract.

## What looks good

Genuinely clean code — emulate, don't change.

- **`apps/api/src/pothos-schema.ts`** (exclusion lists + `requireAdminResolver`). The security perimeter is enumerated, runtime-checked at boot (the `ALLOWED_FIELDS` allowlist + startup assertion), and self-documenting. The four model categories (`AUTH_MODELS`, `CUSTOM_MODELS`, `SENSITIVE_MODELS`, `ADMIN_ONLY_MODELS`) are load-bearing in the best way.
- **`apps/api/src/modules/{server,player,event-*}/*.object.ts`** — Each custom object explicitly comments which sensitive fields are omitted and why. The intent is unmistakable to a future reader; no silent omissions.
- **`apps/api/src/context.ts`** — Lazy per-request DI container with a strictly-typed `Context` interface. New services can't be forgotten; resolvers compile against the shape.
- **`apps/daemon/src/.../ServerLifecycleCoordinator`** (~117 lines) — Fans out shutdown work with `allSettled` and per-step try/catch. Clear, exemplary error isolation. Worth treating as the template for any future coordinator.
- **`apps/daemon/src/modules/player/.../PlayerCommandCoordinator`** (~225 lines) — Small methods, domain-clear names (`handleRankCommand`, `handleStatsCommand`), no cross-cutting concerns.
- **`apps/daemon/src/main.ts`** (`HLStatsDaemon`) — Despite being ~657 lines, lifecycle is explicit (`create` → `start` → `stop`), shutdown phases are timed, signal handling is clean. The length is justified by the orchestration responsibility.
- **`apps/web` page-level data fetching** — Server Components own the Apollo work; client components stay rendering-only. No Apollo-in-JSX antipatterns. Detail pages (`servers/[id]`, `players/[id]`, `games/[code]`) are ~120 lines and focused.
- **`packages/observability/src/prisma/prisma-metrics-extension.ts`** — Follows Prisma's recommended extension pattern; helpers (`getOperationType`, `formatQuery`, `recordQueryMetrics`) are precisely scoped.
- **`packages/crypto/`** — Clear separation (hashing/encryption/tokens), JSDoc'd, co-located tests, pure functions where possible.
- **`packages/auth/src/{session,mail}.ts`** — Thin, focused wrappers around better-auth; mail module's provider router (`sendViaConsole` vs `sendViaResend`) is the right amount of indirection.
