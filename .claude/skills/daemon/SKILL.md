---
name: daemon
description: "Audit the hlstatsnext.com daemon for memory leaks, stability, and fault tolerance — RabbitMQ consumer hygiene, RCON scheduler cleanup, server-state collection growth, shutdown ordering, graceful degradation. Produces a structured findings report. Does NOT fix code."
argument-hint: "<scope: file, module, or 'all' for full apps/daemon scan>"
model: opus
effort: max
---

# Daemon Resilience Auditor

Audit `apps/daemon/` for the failure modes that bite long-running ingestion services: memory leaks, RabbitMQ consumer mishaps, RCON scheduler drift, unbounded server-state growth, shutdown ordering, and the chaos that comes from running for weeks at a time. Combines what hexbot splits across `/memleak` and `/stability`, because for this daemon the two concerns overlap heavily.

This skill **audits and reports only** — it does not modify code.

## Philosophy

The reference framework is **Michael Nygard's stability patterns** (_Release It!_), adapted for a Node.js daemon that ingests UDP game events, drives RCON, persists to MySQL, and publishes/consumes via RabbitMQ. The goal isn't "crash and restart" — it's "catch, recover, degrade gracefully, and never leak."

Key ideas:

- **Fault tolerance** — non-fatal errors caught at the right boundary; one bad UDP packet must not crash the daemon
- **Bulkheading** — one server's RCON failure must not poison another's; one queue's slowness must not block siblings
- **Graceful degradation** — DB unavailable? Stop accepting writes, keep parsing. RabbitMQ down? Buffer briefly, then drop with metric.
- **Self-healing** — RCON reconnect, DB reconnect, MQ reconnect — all with backoff and jitter
- **Steady state** — a daemon up for 90 days must look the same as one up for 90 seconds: bounded memory, no FD leaks, no log growth without rotation
- **Fail fast** — RCON to a dead server should time out in seconds, not minutes
- **Clean shutdown** — `SIGTERM` should drain in-flight work, ack what completed, close handles in order, exit cleanly

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work before you start:
   - If the target is a **phased document**, mirror its phases as tasks.
   - If the scope is **`all`** or a multi-module scan, create one task per module (`ingress`, `rcon`, `messaging`, `server-state`, `database`, `shutdown`, etc.).
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch the `daemon-resilience-scanner` sub-agent in parallel** when scanning multiple modules. The sub-agent returns structured findings; you compile, recalibrate, and write the report. For independent modules, dispatch in parallel via Agent tool calls in one message.
3. **Emit `[ ]` checkboxes for every finding in your output.** Downstream `/execute` will tick them as remediated.

## Context

Always read first:

- `CLAUDE.md` — daemon conventions, shutdown ordering, observability rules
- `apps/daemon/src/main.ts` — `HLStatsDaemon` class, init/teardown sequence
- `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/{client,consumer,event-processor}.ts` — MQ surface
- `apps/daemon/src/modules/rcon/schedulers/rcon-schedule.service.ts` — scheduler/timer surface
- `apps/daemon/src/modules/server/state/server-state-manager.ts` — unbounded-collection risk surface
- `apps/daemon/src/shared/infrastructure/time/system-clock.ts` — timer accounting

The highest-risk surfaces are:

- **RabbitMQ consumers** — ack/nack discipline, prefetch sizing, reconnect, dead-letter handling
- **RCON scheduled commands** — per-server timers, connection state, password decryption lifecycle
- **`server-state-manager`** — in-memory player/server state, eviction on disconnect
- **Shutdown path** — order matters: stop consumers → drain channels → ack pending → close MQ → `$disconnect` Prisma → exit
- **UDP ingress** — malformed packet handling, source validation, backpressure on burst traffic
- **Prisma connection pool** — connection leak under sustained load; transaction abort on disconnect

## Audit process

### Step 1: Scope

- **File/module**: audit that file and direct dependencies
- **Module name** (`rcon`, `ingress`, `messaging`, `server`, etc.): audit the full module under `apps/daemon/src/modules/<name>/` or `apps/daemon/src/shared/`
- **`all`**: audit every `.ts` under `apps/daemon/src/` excluding `**/*.test.ts` and `**/__generated__/**`

### Step 2: Read every file in scope thoroughly

Do not skim. Leaks and stability bugs hide in error branches, disconnect handlers, and the paths that are almost never taken.

### Step 3: Check each category

Dispatch the `daemon-resilience-scanner` sub-agent for the heavy line-by-line pattern matching. Compile its structured findings here, then verify CRITICALs against source before publishing.

#### 3a. Event listener leaks

- `.on()` / `.addListener()` without matching `.off()` / `.removeListener()` in shutdown path
- Anonymous listeners on long-lived emitters (the RabbitMQ client, the RCON sockets, `process`) — cannot be removed later
- Listeners re-added on reconnect without removing old ones — accumulates one per reconnect
- `setMaxListeners()` calls — usually masking accumulation
- `process.on()` handlers added multiple times during init re-runs

#### 3b. Unbounded collections

- `Map` / `Set` / arrays in `server-state-manager` that add per-event without paired delete on PART/QUIT/server-removed
- Caches without TTL or max-size enforcement (player metadata, server config, GeoIP lookups)
- Message history / log buffers that grow per-event
- In-memory schedule entries that grow per RCON command without expiry

#### 3c. Timer leaks

- `setInterval()` without `clearInterval()` in shutdown
- `setTimeout()` recursive patterns without termination
- Interval IDs not stored in a scope accessible to shutdown
- RCON scheduler timers not cleared when a server is removed
- `system-clock` abstractions that wrap timers — verify the wrapper actually clears

#### 3d. RabbitMQ consumer hygiene

The most failure-prone surface. Check:

- Every consumer pairs `subscribe` with `unsubscribe` (or `channel.close`) in shutdown
- Every message handler explicitly `ack`s on success and `nack`s on failure — no silent drops
- `prefetch` is set (otherwise unbounded in-flight messages on slow handlers)
- Dead-letter exchange/queue configured for poison messages (or explicitly accepted as TODO)
- Reconnect logic exists: connection close → backoff → reconnect → re-subscribe consumers
- On shutdown: stop accepting new messages → wait for in-flight to drain (with timeout) → close channel → close connection
- No infinite retry loop on a permanently-failing message (DLQ or drop after N attempts)

#### 3e. RCON resilience

- Per-server RCON connections have idle/connect/read timeouts
- Decrypted passwords held in narrowly-scoped variables, not on shared state
- Failed RCON commands have bounded retry (not infinite); circuit breaker after N consecutive failures
- Scheduled commands skip dead servers (don't pile up waiting on a server that's been offline for days)
- Connection cleanup on server removal — no zombie sockets
- Protocol fragmentation handling (`fragment-response.handler.ts`) doesn't accumulate unbounded fragments waiting for completion

#### 3f. Database (Prisma + MySQL)

- Prisma `$disconnect()` called on shutdown (not on every operation — once, in teardown)
- Long-running transactions bounded by timeout
- Connection pool sized appropriately for daemon concurrency (check `DATABASE_URL` query params or Prisma config)
- Failed writes logged with context (server, event type) — no silent catches
- Schema migration coordination: daemon doesn't run migrations; if schema-incompatible, daemon should fail loudly on startup, not corrupt data silently

#### 3g. Error containment (bulkheads)

- Every event handler wrapped in try/catch at the dispatcher boundary
- Unhandled promise rejections caught at the top-level (`process.on('unhandledRejection')` logs and continues, doesn't crash)
- `process.on('uncaughtException')` exists and logs with full context
- One module's failure doesn't sink siblings (e.g., RCON scheduler failure must not stop UDP ingress)

#### 3h. Graceful degradation

- DB unavailable → log, drop the write (or queue if appropriate), keep parsing
- RabbitMQ unavailable → log, attempt reconnect, do not block UDP ingress
- RCON unavailable for a server → mark server unreachable, skip scheduled commands for it, retry periodically
- Malformed UDP packet → log with packet sample, drop, increment metric — do not throw into the event loop

#### 3i. Shutdown ordering

The most under-tested path. The right order is:

1. Stop accepting new work (close UDP socket, stop RabbitMQ consumers)
2. Drain in-flight (await pending handlers with a timeout — ~5s typical)
3. Close RCON connections
4. Close RabbitMQ channels and connection
5. `prisma.$disconnect()`
6. Flush logs (Winston flush)
7. `process.exit(0)` (or 1 on shutdown failure)

Check: `SIGTERM` and `SIGINT` handlers present, in the right order, with timeouts on each phase. A shutdown that hangs > 30s gets `SIGKILL` from supervisor and loses in-flight work.

#### 3j. Self-healing & observability

- Reconnect loops have backoff + jitter (not naked `setInterval(reconnect, 1000)`)
- Metrics emit per failure category (consumer.error, rcon.timeout, db.disconnect) so dashboards can spot drift
- Last-event timestamps tracked per source — operator can tell if ingress has gone silent
- Watchdogs on critical loops (or explicitly noted as relying on supervisor restart)

### Step 4: Check Nygard anti-patterns specifically

These are the named failure modes from _Release It!_ — flag any that apply to the daemon:

- **Integration points** — every external call (DB, MQ, RCON, UDP source) is one; verify defenses
- **Chain reactions** — one failure causes another in the same layer (one consumer crash takes down sibling consumers)
- **Cascading failures** — one layer's failure cascades (RCON failures → scheduler crash → ingest backup → MQ overflow)
- **Blocked threads** — sync work or unresolved await blocking the event loop
- **Slow responses** — RCON timeout too long, holding scheduler thread for minutes
- **Unbounded result sets** — `findMany()` without `take` on a growing table
- **Dogpile / thundering herd** — all servers reconnect at once after MQ recovery
- **Self-denial attacks** — daemon issues so much traffic on reconnect it gets rate-limited or blacklisted

### Step 5: Write report

Write to:

```
docs/audits/daemon-<scope-slug>-<YYYY-MM-DD>.md
```

```markdown
# Daemon Audit: <scope>

**Date:** YYYY-MM-DD
**Scope:** <what was audited>
**Estimated resilience:** <Low / Medium / High>

## Summary

<2-3 sentences: overall assessment, biggest fragility, expected survival time under realistic chaos (RabbitMQ restart, MySQL failover, dead game server, malformed UDP burst). Findings: X critical, Y warning, Z info.>

## Findings

### [CRITICAL] <title>

- [ ] **File:** `path:line`
      **Pattern:** <listener-leak | unbounded-collection | timer-leak | mq-ack | rcon-resilience | shutdown-order | error-containment | etc.>
      **Anti-pattern (if Nygard):** <e.g., "integration point without timeout">
      **Scenario:** <real-world event — "RabbitMQ restart at 3am", "game server hung", "Prisma pool exhausted">
      **Description:** <what breaks and why>
      **Evidence:** <quote the specific code>
      **Growth/Impact:** <"one listener per reconnect, ~30/day in unstable network", or "daemon offline until manual restart">
      **Remediation:** <specific fix>

### [WARNING] ...

### [INFO] ...

## Stable patterns found

<Call out code that correctly handles cleanup, recovery, ack discipline, shutdown — these are templates for fixes.>

## Recommendations

<Prioritized list, grouped by effort: Quick wins / Medium / Architectural.>

## Provenance

<How many CRITICALs the sub-agent returned vs survived recalibration. Note any demotions and why.>
```

After writing, print a 2-4 line summary with file path and counts. Do not paste the whole document.

## Severity levels

The bar for CRITICAL is strict. A finding is CRITICAL only when ALL of these hold:

1. The triggering event is realistic in actual deployment (RabbitMQ restart, MySQL failover, dead game server, malformed UDP packet, sustained high event rate — not a theoretical adversary, not a fixture that only happens at 10× current scale)
2. The blast radius is "daemon is offline or a core subsystem is wedged" — not "noisy logs," not "operator-recoverable," not "minor metric blip"
3. There is no in-process compensating mechanism (Prisma retry, MQ DLQ, AbortController timeout, supervisor restart) that already mitigates it

If any clause fails, the finding is WARNING or INFO. When in doubt, downgrade.

- **CRITICAL** — meets the three-part bar. Fix before deploying.
- **WARNING** — recovery works but is degraded, scale-dependent, or operator-recoverable. Fix before long-term unattended operation. Tag `[at-scale]` if only relevant past current scale.
- **INFO** — defense-in-depth, observability gap, or pattern that isn't currently exploited. Address when convenient.

### Severity recalibration is mandatory

The scanner sub-agent inflates severity. Before publishing:

1. **Verify every CRITICAL claim against source.** Open the cited file at the cited line and check the claim holds; demote on disagreement.
2. **Apply the 3-part bar.** Demote any CRITICAL that fails.
3. **Document the recalibration** in the `## Provenance` section: "Sub-agent returned N CRITICALs; M survived recalibration."

## Guidelines

- **Be concrete about the scenario.** "What happens at 3am when RabbitMQ restarts?" beats ten abstract findings. Every finding should name the real-world trigger.
- **Estimate survival time.** "Daemon would last ~12 hours under normal load before FD exhaustion" is more useful than "there are stability issues."
- **Silent catches are always a finding.** `catch (e) {}` is never correct; at minimum it must log with context.
- **A `setInterval` without a paired clear on shutdown is a stability issue**, not just a leak — it means the daemon cannot shut down cleanly.
- **Distinguish "prevented" from "contained."** Preventing an error is better than catching it. Flag cases where containment masks a preventable bug.
- **`try/catch` around `await` is not the same as `.catch()` on a detached promise.** Both are needed in different places; check the right one is used.
- **A `Map` that grows to the number of active servers and stays there is NOT a leak** — it's bounded state. A `Map` that grows per UDP event IS a leak.
- **A clean audit is valuable.** If a module handles things correctly, say so — it builds confidence and provides a template.
- **Do not propose rewrites without flagging scope.** "Add a supervisor tree" is a real answer but not a quick fix.
- **Cross-reference `/security` findings on the daemon if both have run** — encryption-at-rest and credential lifecycle overlap with shutdown discipline.

Target: $ARGUMENTS
