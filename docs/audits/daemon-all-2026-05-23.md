# Daemon Audit: all

**Date:** 2026-05-23
**Scope:** `apps/daemon/src/**` — ingress, RCON, RabbitMQ messaging, server-state, database lifecycle, shutdown orchestration, shared infrastructure (clock/cache/CQRS/observability), and all module event handlers (player/match/action/weapon/ranking/geoip/map/game/options). Tests, generated files, and dist excluded.
**Cross-cuts:** `packages/observability/` (Prometheus exporter — called from the daemon hot path).
**Estimated resilience:** **Low–Medium**

## Summary

The daemon ingests and forwards events well **as long as nothing goes wrong outside the process.** The first RabbitMQ blip, broker restart, or sustained network instability triggers a class of failures that the daemon cannot recover from: the publisher caches a dead channel forever, every event afterward is dropped silently with a log line, and the `/health` endpoint still reports healthy. There are no publisher confirms, no `unhandledRejection` handler, no overall shutdown timeout, and no draining of in-flight handlers before subsystems tear down — so any restart or SIGTERM during sustained load loses or duplicates events. The Prometheus exporter accumulates every histogram sample forever and will OOM the process in days at the documented event rate. RCON debug logs leak plaintext passwords. Server-state cleanup is wired into a `SERVER_SHUTDOWN` event whose subscriber does not exist.

**Expected survival under realistic chaos:**

- **RabbitMQ restart (every blip thereafter):** silent message loss until daemon is restarted.
- **MySQL failover (~30s):** in-flight tx hangs, no per-call timeouts → publisher backs up → memory grows.
- **Dead game server:** Source-RCON sockets never time out (default keepalive 2h); `pendingResponses` map leaks one entry per command timeout.
- **Malformed UDP burst from spoofed IPs:** `AuthRateLimiter.entries` + `loggedMessages` grow unboundedly per source IP — slow OOM over hours of scanner traffic.
- **Continuous run at 1k events/sec:** Prometheus histograms accumulate ~1 sample/event × ~60 keys → ~5 GB heap in one week, scrape latency monotonically increasing.

**Findings:** **15 critical, 22 warning, 13 info.**

The single highest-leverage fix is invalidating cached channel references on close/error in `EventPublisher` and `EventConsumer` (CRIT-2/CRIT-3) — this unlocks recovery from every transient blip and is a precondition for safely adding publisher confirms (CRIT-4).

---

## Findings

### [CRITICAL] CRIT-1 — RCON plaintext password leaked into debug logs

- [x] **File:** `apps/daemon/src/modules/rcon/protocols/goldsrc-rcon.protocol.ts:269`
      **Pattern:** credential-handling
      **Scenario:** Any deployment with `LOG_LEVEL=debug`, or any operator toggling debug to diagnose an RCON issue, writes plaintext RCON passwords to Winston logs and stdout. Logs typically ship to centralized aggregation (Loki/ELK/Datadog) with weeks of retention; one debug session simultaneously discloses passwords for every monitored server.
      **Description:** The debug log includes `bufferHex: commandBuffer.toString("hex").substring(0, 100)`. The buffer is built at line 295-300 as `Buffer.concat([0xffffffff preamble, "rcon <challenge> <rconPassword> <command>\n"])`. The first 100 hex chars = 50 bytes = preamble (4) + `"rcon "` (5) + challenge (~10) + space (1) + the start of the password. Decoding hex from a single log line gives the plaintext.
      **Evidence:**
      ``ts
this.logger.debug(
  `GoldSrc RCON: Sending command to ${this.serverAddress}:${this.serverPort}`,
  { command, challenge: this.challenge, bufferLength: commandBuffer.length,
    bufferHex: commandBuffer.toString("hex").substring(0, 100) },
)
``
      **Growth/Impact:** Catastrophic on first debug toggle. Explicitly violates the project rule in CLAUDE.md: "RCON passwords... never log, never serialize."
      **Remediation:** Remove `bufferHex` from the debug log, or sanitize to the first 9 bytes (preamble + `"rcon "`) only.

### [CRITICAL] CRIT-2 — Publisher caches a dead channel forever after the first reconnect

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/publisher.ts:30, 129-133`
      **Pattern:** mq-reconnect
      **Anti-pattern (Nygard):** Integration point without invalidation; stale handle as silent failure.
      **Scenario:** RabbitMQ restart at 3am, or any 1-second network blip. The `RabbitMQClient` reconnects (5 attempts, ~30s), but `EventPublisher.channel` still points at the dead channel from the old connection.
      **Description:** `ensureChannel()` only creates a channel when `this.channel === null`. There is no `channel.on('close', ...)` listener that nulls the reference. Every subsequent `publish()` throws `IllegalOperationError`; ingress catches at `ingress.service.ts:190-198`, logs "Error processing log line", and **drops the event silently** (`totalErrors++`). The daemon's `/health` reports `healthy` (CRIT-9) because the check only verifies `!!context.queueModule`.
      **Evidence:**
      `ts
private async ensureChannel(): Promise<void> {
  if (!this.channel) {
    this.channel = await this.client.createChannel("publisher")
  }
}
`
      **Growth/Impact:** Total publishing outage from the first MQ blip until manual restart. Every game event for hours is permanently lost while the daemon appears alive.
      **Remediation:** Register `channel.on('close', () => { this.channel = null })` and `channel.on('error', ...)` after creation. Also expose `on(event, listener)` on `QueueChannel` adapter — currently the abstraction hides the channel's events entirely (see CRIT-9).

### [CRITICAL] CRIT-3 — Consumer caches dead channels; no re-subscribe on reconnect

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:53` and `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:218-269`
      **Pattern:** mq-reconnect
      **Scenario:** RabbitMQ restart. Client reconnects and creates new channels lazily. The consumer's `start()` is a one-shot at boot — its `consume(...)` registration is on the old (now-dead) channel.
      **Description:** `EventConsumer.channels` is a Map populated during `start()`. After client reconnects, there's no event wired to re-establish `consumeQueue()`. The daemon will eventually publish again (after CRIT-2 is fixed) but will stop consuming.
      **Evidence:** `consumer.ts` has no listener on the client's `"close"` / `"error"` / `"connected"` events. The client itself only logs connection state changes (`client.ts:194-216`).
      **Growth/Impact:** After the first reconnect, the consumer is dead but the daemon process keeps running. Messages pile up in the broker until the queue's `x-max-length` / `x-message-ttl` triggers DLQ routing — see WARN-3.
      **Remediation:** Add `'connected'` event to `IQueueClient`, have `EventConsumer` re-issue `consumeQueue()` on every reconnect. Fix jointly with CRIT-2.

### [CRITICAL] CRIT-4 — No publisher confirms; every published event can be lost on broker crash

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/publisher.ts:41-91`
      **Pattern:** mq-ack (publisher-side durability)
      **Anti-pattern (Nygard):** False sense of durability.
      **Scenario:** RabbitMQ crash, OOM, host reboot. amqplib accepts the publish (TCP write succeeds) but the broker never persists to disk before crashing.
      **Description:** `EventPublisher` uses an ordinary channel from `client.createChannel(...)`, not a confirm channel. No `createConfirmChannel`, no `waitForConfirms`, no `'ack'`/`'nack'` listener. `channel.publish(...)` returns boolean — `true` means "buffer accepted", not "broker persisted". Combined with `persistent: true` (line 54), this gives operators the _impression_ of durability without actually guaranteeing it.
      **Evidence:** `grep -nR "confirm\|waitForConfirms" apps/daemon/src/shared/infrastructure/messaging` → no matches.
      **Growth/Impact:** Every event between the last broker fsync and the broker crash is lost — typically seconds of traffic per crash. Per CLAUDE.md ("daemon must never lose events"), this is a violation of the core invariant.
      **Remediation:** Use `connection.createConfirmChannel()`. Either per-message callbacks or batch `waitForConfirms()`. On nack from broker, requeue locally or persist to disk for retry.

### [CRITICAL] CRIT-5 — Silent message loss when broker flow-controls (`connection.blocked`)

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/publisher.ts:67-69` and `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:209-215`
      **Pattern:** mq-ack
      **Anti-pattern (Nygard):** Slow response / unbounded buffer / no backpressure.
      **Scenario:** Broker hits memory or disk high-water mark and sends `connection.blocked`. The daemon logs it but takes no defensive action. TCP buffer eventually fills; `channel.publish()` returns `false`.
      **Description:** Publisher converts buffer-full into a thrown `QueuePublishError`. Ingress catches at `ingress.service.ts:190` and drops the event. No retry, no in-memory buffer, no backpressure to the UDP socket, no metric distinguishing "blocked-loss" from other errors.
      **Evidence:**
      `ts
if (!published) {
  throw new QueuePublishError("Channel buffer full - message not published")
}
`
      **Growth/Impact:** Sustained event loss for the duration of any broker memory-pressure event. Invisible in monitoring.
      **Remediation:** On `'blocked'` set a flag, have publisher buffer (bounded) or apply UDP-side backpressure (drop oldest with metric). Emit a Prometheus counter `events_lost_on_publish_blocked`.

### [CRITICAL] CRIT-6 — Retry pattern double-writes the same message to DLQ; DLQ grows forever

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:346-381` and topology at `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:286-326, 374`
      **Pattern:** mq-dlq
      **Anti-pattern (Nygard):** Unbounded result set.
      **Scenario:** Any persistent handler failure (schema mismatch, downstream DB outage). The retry algorithm dead-letters the original _and_ republishes a copy. After N retries, you get N entries in DLQ for one logical event, plus one final DLQ entry on exhaustion.
      **Description:** On error, `channel.nack(msg, false, false)` (requeue=false) immediately routes to DLQ because each source queue has `x-dead-letter-exchange: hlstats.events.dlx`. Then `setTimeout` republishes a fresh copy to `hlstats.events`. The DLQ has no `x-message-ttl`, no `x-max-length`, and no consumer (grep for `hlstats.events.dlq` matches only declaration and binding).
      **Evidence:** consumer.ts:360 nack-with-no-requeue → DLX → DLQ; consumer.ts:364-372 setTimeout republish → new copy.
      **Growth/Impact:** Each persistent failure produces N+1 DLQ entries. Over weeks of flaky downstream, the DLQ becomes the broker's largest queue, eventually exhausting broker memory.
      **Remediation:** Don't nack on retry — keep the message in flight, schedule republish, ack the original once the new copy is confirmed (requires publisher confirms, CRIT-4). Or use the broker's delayed-message plugin. Add `x-message-ttl` and `x-max-length` to DLQ. Add a DLQ consumer that logs + persists to Prisma for human review.

### [CRITICAL] CRIT-7 — `ingressService.stop()` is fire-and-forget; UDP socket not awaited, in-flight events lost

- [x] **File:** `apps/daemon/src/modules/ingress/ingress.service.ts:82-88` (interface in `ingress.types.ts:23`)
      **Pattern:** shutdown-order
      **Scenario:** `docker stop` with 10s grace, or any SIGTERM during sustained load.
      **Description:** `stop()` is declared `void` and calls `this.udpServer.stop()` without awaiting (it returns `Promise<void>`). `main.ts:316-322` passes the synchronously-resolved value into `Promise.all`, which resolves the ingress slot immediately. Meanwhile `databaseConnection.disconnect()` runs on line 324; any in-flight `handleLogLine()` mid-Prisma-call gets a mid-transaction error.
      **Evidence:**
      `ts
stop(): void {                  // returns void, signature swallows the promise
  if (this.running) {
    this.logger.stopping("Ingress Server")
    this.udpServer.stop()       // returns Promise<void>, NOT awaited
    this.running = false
  }
}
`
      **Growth/Impact:** Every shutdown drops the in-flight parse/publish chain. The error surfaces as "Error processing log line" caught at line 190 and silently increments `totalErrors`.
      **Remediation:** Make `IIngressService.stop()` async, `await this.udpServer.stop()`. Also track in-flight handler count and drain before closing.

### [CRITICAL] CRIT-8 — Shutdown parallelism: dependencies torn down while in-flight handlers still run

- [x] **File:** `apps/daemon/src/main.ts:303-332` (`Promise.all([...])` at 316)
      **Pattern:** shutdown-order, mq-ack
      **Scenario:** SIGTERM during ~1k events/sec burst. Several event handlers are mid-flight.
      **Description:** Five subsystems shut down in parallel via `Promise.all`. There is no "stop accepting → drain → close dependencies" phasing. Cache (Garnet/Redis) and publisher channel can be torn down while a still-running handler is mid-write. RabbitMQ consumer cancels its consumer tag (consumer.ts:152) but the handler's `ack(msg)` will fire _after_ the channel closes → `IllegalOperationError` → message un-acked → RabbitMQ redelivers on reconnect → duplicate processing. With `prefetchCount=10 × 3 queues = 30`, up to 30 messages may be redelivered on each restart. Handlers in this codebase are **not idempotent** at the DB layer (`chat_message`, `Eventfrag`, `Action`, `EventEntry`, `EventChangeName`, etc. all insert new rows / cumulatively award points).
      **Evidence:** No `inflightCount` tracking exists in `EventConsumer`. `consumer.ts:148-168` exits without `await Promise.all(pendingHandlers)`.
      **Growth/Impact:** Stat drift accumulates over every restart. With a daemon restart cadence of weekly, expect dozens of duplicated player events per restart.
      **Remediation:** Track in-flight handler promises in `EventConsumer.inflight: Set<Promise<void>>`. In `stop()`: (1) cancel consumer tags; (2) `await Promise.race([allSettled(inflight), timeout])`; (3) only then close channels/connection. Add idempotency keys to event handlers as defense in depth.

### [CRITICAL] CRIT-9 — Channel-level error/close events have no listeners; channel death undetected

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/adapters.ts:22-137` and `client.ts:119-141`
      **Pattern:** mq-reconnect (missing listeners)
      **Scenario:** Broker closes a single channel — e.g., precondition-failed on assertQueue mismatch, per-channel exception from amqplib, unroutable mandatory publish. Connection stays up but the channel is dead.
      **Description:** `AmqpChannelAdapter` does not expose `on(event, listener)` at all. `RabbitMQClient.createChannel` does not attach any handler. Only `connection.on(...)` listeners exist. When `channel.publish()` fires on a dead channel, amqplib throws `IllegalOperationError` — but the cached references in `EventConsumer.channels` and `EventPublisher.channel` are never invalidated. Daemon reports "connected" while every operation throws.
      **Evidence:** `QueueChannel` interface has no event surface.
      **Growth/Impact:** Per-channel failures silently disable that consumer/publisher permanently while `/health` is green. Feeds CRIT-2/CRIT-3.
      **Remediation:** Add `on(event, listener)` to `QueueChannel`. Attach `'close'` and `'error'` handlers that null the cached reference and trigger re-create + (for consumers) re-subscribe.

### [CRITICAL] CRIT-10 — No `unhandledRejection` / `uncaughtException` handlers

- [x] **File:** `apps/daemon/src/main.ts:450-462` (only SIGINT/SIGTERM registered)
      **Pattern:** error-containment, signal-handler
      **Scenario:** Any unawaited async error anywhere in the codebase. Node 22+ exits with code 1 by default; no shutdown runs → Prisma client leaks, RabbitMQ messages get redelivered + double-processed on next start, RCON sockets stay open.
      **Description:** `grep -nR "unhandledRejection|uncaughtException" apps/daemon` returns zero matches.
      **Growth/Impact:** A single detached promise rejection takes the daemon down with no observability and unclean shutdown. With many silent-catch patterns elsewhere returning success (CRIT-15, WARN-handlers), the failure mode is fragile.
      **Remediation:**
      ``ts
process.on("unhandledRejection", (reason, p) => {
  logger.error(`Unhandled rejection: ${reason}`, { promise: String(p) })
  metrics.incrementCounter("unhandled_rejections_total")
})
process.on("uncaughtException", async (err) => {
  logger.error(`Uncaught exception: ${err.stack}`)
  try { await daemon.stop() } catch {}
  process.exit(1)
})
``

### [CRITICAL] CRIT-11 — No overall shutdown timeout; one stuck dependency hangs the process until SIGKILL

- [x] **File:** `apps/daemon/src/main.ts:303-332`
      **Pattern:** shutdown-timeout
      **Scenario:** RabbitMQ partition. `queueModule.shutdown() → client.disconnect() → connection.close()` blocks indefinitely on the AMQP connection. Docker's 10s grace expires → SIGKILL. Prisma never disconnects, metrics endpoint still serving.
      **Description:** No `Promise.race(stop, sleep(deadline))`, no per-phase timeout, no `AbortController` anywhere in main.ts. The signal handler `await`s `daemon.stop()` before `process.exit(0)`, making the daemon unkillable except via SIGKILL.
      **Remediation:** Wrap each phase in a per-step timeout (5s) and wrap `stop()` overall in a deadline (25s) — `process.exit(1)` if exceeded.

### [CRITICAL] CRIT-12 — Reconnect gives up after 5 attempts; daemon stays alive but messaging is dead

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:230-254`
      **Pattern:** mq-reconnect
      **Anti-pattern (Nygard):** Failure with no recovery; silent degradation.
      **Scenario:** RabbitMQ down for >30s (rolling upgrade, partition, host reboot).
      **Description:** `attemptConnection` retries up to `maxAttempts = 5`. On exhaustion: log error and stop. Counter is only reset on a successful `connect()`. No scheduled re-arm, no escalation. The daemon process runs with `this.connection === null` forever; `/health` returns `degraded` but no auto-recovery.
      **Remediation:** After `maxAttempts`, transition to a longer-interval poll (every 30s–1m), forever, with jitter. Expose a Prometheus gauge `rabbitmq_connected` so an external watchdog can act.

### [CRITICAL] CRIT-13 — Prometheus exporter accumulates every histogram sample forever

- [x] **File:** `packages/observability/src/prometheus/prometheus-metrics-exporter.ts:47-52, 138-173`
      **Pattern:** unbounded-collection, metric-cardinality
      **Scenario:** Sustained daemon load. The daemon calls `recordHistogram` from `event-processor.ts:75, 99` (once per event) and from `prisma-metrics-extension.ts:154` (once per Prisma query) — both confirmed active production call sites.
      **Description:** `recordHistogram` pushes raw values onto a Map of arrays that is never trimmed. `exportMetrics()` runs `values.reduce(...)`, `values.filter(...)` per bucket on every scrape. No bucket-counter aggregation as in the standard `prom-client` library.
      **Evidence:**
      `ts
recordHistogram(name, labels = {}, value) {
  const key = this.getMetricKey(name, labels)
  const values = this.histograms.get(key) || []
  values.push(value)
  this.histograms.set(key, values)
}
`
      **Growth/Impact:** At 1k events/sec × ~60 label-keys, ~5 GB heap in one week from this Map alone. Every Prometheus scrape (default 15s) becomes O(N) over the entire history — scrape latency grows monotonically and eventually starves the event loop.
      **Remediation:** Replace with bucket-counter aggregation (increment per-bucket count + sum + count on each observation; no raw retention). Either replace this module with the standard `prom-client` library or rewrite to that semantic. Snapshot-and-clear on scrape is the bare minimum.

### [CRITICAL] CRIT-14 — GoldSrc RCON `sendRconCommand` leaks message listeners on every timeout

- [x] **File:** `apps/daemon/src/modules/rcon/protocols/goldsrc-rcon.protocol.ts:273-289`
      **Pattern:** listener-leak
      **Scenario:** A command times out (frequent against an unstable/dead server). The `setTimeout(reject, commandTimeout)` callback at line 273 does not `clearTimeout` or `socket.off("message", onMessage)`. The listener is removed only on a `socket.send` error (line 283) or `messageHandler`'s success branch.
      **Description:** With monitoring every 30s and frequent timeouts during network instability, the long-lived UDP socket accumulates 30+ stale listeners per hour per server. Eventually `EventEmitter` warning at 10, then unbounded growth until `cleanup()` fires (only on disconnect — which doesn't happen for the timeout case). The `getChallengeFromServer` timeout path (line 190-195) has the same defect.
      **Evidence:** Lines 273-289 show the missing cleanup on the timeout branch.
      **Growth/Impact:** ~30 listeners/hour/server during instability. Listener array growth, microtask churn, eventual memory pressure.
      **Remediation:** Single `cleanup = () => { clearTimeout(timeout); this.socket?.off("message", onMessage) }` reused by every reject path.

### [CRITICAL] CRIT-15 — `handleServerShutdown` is declared but never registered or implemented

- [x] **File:** `apps/daemon/src/modules/server/server.types.ts:15` (declaration only; verified via grep — no subscriber, no implementation)
      **Pattern:** eviction-missing
      **Scenario:** Any game server shutdown (sends SERVER_SHUTDOWN log line) — restart, map-cycle out, manual stop, daemon witnessing a server going dark.
      **Description:** `EventType.SERVER_SHUTDOWN` exists (`shared/types/events.ts:39`) and is routed to topic `server.shutdown` (publisher.ts:203), but **no subscriber consumes it**. When a game server shuts down, nothing flushes the per-server in-memory state. Stranded state across at least 8 modules: - `PlayerSessionRepository` (5 Map entries per session) - `ServerStateManager.serverStates` + `lastActivity` - `MatchService.currentMatches` (with nested `playerTeams: Map<number, string>`) - `MapService.mapCache`, `GameDetectionService.gameCache` - `NotificationConfigRepository.configCache` - `RconScheduleService.serverExecutions` and `RetryBackoffCalculatorService.failureStates` - Open RCON sockets in `RconService.connections`
      **Growth/Impact:** One full stranded set per surprise server restart (common in production). Cumulative leak proportional to deployment churn.
      **Remediation:** Subscribe to `server.shutdown` from a coordinator that fans out cleanup across all listed modules. While at it, add a sibling `SERVER_REMOVED` event for admin-initiated deletions and route to the same cleanup.

---

### [WARNING] WARN-1 — Unbounded `loggedMessages` and `AuthRateLimiter.entries` Maps grow per source IP

- [x] **File:** `apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts:59` (loggedMessages) and `apps/daemon/src/modules/ingress/utils/rate-limiter.ts:34` (entries)
      **Pattern:** unbounded-collection
      **Scenario:** Random internet UDP scans, spoofed-source UDP flood, or just IP churn over time.
      **Description:** `loggedMessages` is keyed by `"source-unknown-<ip>"` or `"beacon-ok-<ip>:<ephemeral-port>"` and never evicts (the `clearCaches()` and `clear()` methods are only called from tests). `AuthRateLimiter.entries` is keyed by source IP — even when `blockedUntil` expires, the entry is left behind with empty `attempts: []`.
      **Growth/Impact:** ~1 entry per unique source IP ever seen. Scanner traffic and ephemeral-port rotation accumulate hundreds-of-thousands of entries over weeks. Bounded by IP space but unbounded in practice — slow OOM on the order of weeks under sustained attack.
      **Remediation:** Periodic sweep (clearable on shutdown) that drops entries with `lastSeen > LOG_COOLDOWN_MS * 2` and rate-limit entries that have aged out (`blockedUntil === null && attempts.length === 0`).

### [WARNING] WARN-2 — `PlayerSessionRepository` has no eviction for ghost sessions

- [x] **File:** `apps/daemon/src/modules/player/repositories/player-session.repository.ts:24-36, 91-110`
      **Pattern:** unbounded-collection, ghost-session
      **Scenario:** Server crash (no QUIT log line sent), packet loss on the disconnect line, kick during connect handshake, mid-game map change with reissued userids.
      **Description:** Five parallel Maps shed entries only via `deleteSession()` (called from `DisconnectEventHandler`) or `deleteServerSessions()` (`synchronizeServerSessions`). No `lastSeen`-based TTL, no max-size, no RCON reconciliation.
      **Growth/Impact:** ~120 leaked sessions/day per server under 10% disconnect-line loss. Across 50 servers: 6k/day, 180k/month.
      **Remediation:** Periodic sweep: drop sessions with `lastSeen` older than ~30 min (configurable). Update `lastSeen` from any per-player event handler. Optionally reconcile against RCON `status` periodically.

### [WARNING] WARN-3 — Source queues silently drop messages older than 1 hour to DLQ; DLQ is a black hole

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:292-326`
      **Pattern:** mq-dlq
      **Scenario:** Daemon down >1h for maintenance, or consumer outage (CRIT-3) that nobody noticed.
      **Description:** Each source queue has `"x-message-ttl": 3600000`. Expired messages route to DLX → DLQ. DLQ has no `x-message-ttl`, no `x-max-length`, no consumer.
      **Growth/Impact:** Hidden silent data loss during any maintenance window; DLQ grows monotonically over the broker's lifetime.
      **Remediation:** Add `x-max-length` (e.g., 10000) with overflow `drop-head` to DLQ. Add a lightweight DLQ consumer that at minimum increments a Prometheus counter per event-type. Decide: either drop the source TTL (rely on length cap to protect broker) or document the 1h-discard as intentional.

### [WARNING] WARN-4 — `pause()` requeues at head, causing busy-spin between consumer and broker

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:235-239`
      **Pattern:** nygard-antipattern (self-denial)
      **Scenario:** Operator calls `pause()` to throttle.
      **Description:** Broker keeps delivering up to `prefetchCount` messages; each is `nack`'d with `requeue=true` and immediately redelivered (nothing else is consuming). The consumer spins at 100% CPU shuffling the same 10 messages.
      **Remediation:** In `pause()`, call `channel.cancel(consumerTag)` per channel; in `resume()`, re-`consume`. Don't use nack-requeue as a flow control.

### [WARNING] WARN-5 — `concurrency` config is dead — only logged, never enforced

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:118, 495`
      **Pattern:** nygard-antipattern (misleading config)
      **Description:** `RabbitMQConsumerConfig.concurrency = 10` is logged but never referenced. Actual parallelism = `prefetchCount × queueCount`. Operators tuning the value see no behavioral change.
      **Remediation:** Either delete the field or wire it to a semaphore around `handleMessage`. If the prefetch-per-channel pattern is intentional, rename to `prefetchPerChannel`.

### [WARNING] WARN-6 — Hardcoded queue topology ignores `RabbitMQConfig.queues` — `maxLength` config is dead

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/client.ts:272-336`; defaults at `messaging/module.ts:255-302`
      **Pattern:** unbounded-collection (broker-side)
      **Description:** `setupTopology` hardcodes its own args and never reads `this.config.queues[*].options`. The `maxLength: 50000 / 75000 / 100000` declarations in config are inert.
      **Growth/Impact:** Queues protected only by `x-message-ttl: 3600000`. At 1k events/sec sustained downstream stall, 3.6M messages in one hour → broker OOM kill.
      **Remediation:** Wire topology to read from config. At minimum, declare `x-max-length` with overflow `reject-publish` so the broker pushes back.

### [WARNING] WARN-7 — Heartbeat interval 60s; dead-TCP detection takes up to 2 minutes

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/module.ts:249`
      **Pattern:** nygard-antipattern (integration point without timeout)
      **Description:** AMQP closes after 2 missed heartbeats = 120s of silent black-hole publishing through a TCP socket the broker isn't reading. Combined with CRIT-4 (no confirms), every publish in that window is silently lost.
      **Remediation:** Lower to 10-15s.

### [WARNING] WARN-8 — `setTimeout` retry republish + reconnect timers not tracked on shutdown

- [x] **File:** `apps/daemon/src/shared/infrastructure/messaging/queue/core/consumer.ts:364-372` and `client.ts:239`
      **Pattern:** timer-leak, mq-ack
      **Description:** Timer handles for retry republish and reconnect attempts are not stored. On shutdown, they fire against either a closed channel (throws, swallowed) or — worse — a still-open one during connection-close race. Original message already in DLQ, retry never happens.
      **Remediation:** Store handles in a Set; clear all in `stop()`. For long-term: use a delayed-message exchange or RabbitMQ delayed-message plugin so retry timing lives in the broker.

### [WARNING] WARN-9 — Per-server RCON connections never reclaimed on server delete/disable

- [x] **File:** `apps/daemon/src/modules/rcon/services/rcon.service.ts:22, 27` and `services/retry-backoff-calculator.service.ts:13`
      **Pattern:** unbounded-collection, zombie-socket
      **Scenario:** Admin removes Server #42, disables RCON, or rotates credentials with address change. There is no `SERVER_REMOVED` event (verified: zero matches).
      **Description:** Open UDP/TCP socket stays in `RconService.connections` until either a scheduled monitor run errors (delete on failure at rcon.service.ts:173) or daemon restart. Status polls may succeed against a different server now at the same address. `commandQueues` Promise chains and `failureStates` Map accumulate.
      **Growth/Impact:** One leaked entry per removed server per restart cycle. Eventually `EMFILE`.
      **Remediation:** Emit a `SERVER_REMOVED` event; subscribe in RCON to `disconnect(serverId)` + clean the queue/state maps. Add reconciliation in `executeScheduleForServers`: any `connections` entry not in the active-server result should be disconnected. Fold into CRIT-15 cleanup chain.

### [WARNING] WARN-10 — RCON reconnect dogpile; no jitter on backoff

- [x] **File:** `apps/daemon/src/modules/rcon/services/retry-backoff-calculator.service.ts:42-58` and `commands/scheduled/server-monitoring.command.ts:117-119`
      **Pattern:** nygard-antipattern (dogpile, self-denial)
      **Scenario:** Network blip causes all monitored servers to fail simultaneously. `calculateNextRetry` is deterministic — all servers compute the same `nextRetryAt`. On the recovery tick, `Promise.allSettled(servers.map(...))` fires N concurrent connects.
      **Description:** `grep -r "jitter|Math.random" apps/daemon/src/modules/rcon` returns no matches. With N=50 servers this is 50 simultaneous connects on the recovery tick.
      **Remediation:** Add jitter (`finalDelaySeconds * (0.5 + Math.random() * 0.5)`). Cap concurrent connects (e.g., p-limit with concurrency=10) for `Promise.allSettled`.

### [WARNING] WARN-11 — Source-RCON socket has no keepalive or connection timeout

- [x] **File:** `apps/daemon/src/modules/rcon/protocols/source-rcon.protocol.ts:39-40, 126-139`
      **Pattern:** rcon-resilience
      **Anti-pattern (Nygard):** Integration point without timeout.
      **Description:** No `socket.setKeepAlive(true, ...)` call; default `tcp_keepalive_time` is 2 hours. A wedged TCP connection persists for hours. `withTimeout` wraps the Promise but does NOT cancel the underlying `connect()`. `commandTimeout` rejects the Promise but leaves stale entries in `pendingResponses` (separate WARN below).
      **Remediation:** `socket.setKeepAlive(true, 30_000)` and `socket.setTimeout(commandTimeout * 2)`; on `'timeout'` destroy + emit close.

### [WARNING] WARN-12 — Source-RCON `pendingResponses` Map leaks one entry per command timeout

- [x] **File:** `apps/daemon/src/modules/rcon/protocols/source-rcon.protocol.ts:21, 162-174`
      **Pattern:** unbounded-collection
      **Description:** Command sent, server doesn't respond, `withTimeout` rejects, but the `pendingResponses.set(commandId, { resolve, reject })` entry is only deleted on real response or socket close — neither happens for the timeout case.
      **Growth/Impact:** ~2880 leaked entries/day per slow server at 30s monitor interval. Each retains closures over `this`.
      **Remediation:** Wrap the Promise in a per-command timeout that deletes the entry before rejecting.

### [WARNING] WARN-13 — `PlayerStatusEnricher.enrichmentCache` and `GameDetectionService.gameCache` unbounded

- [x] **File:** `apps/daemon/src/modules/player/enrichers/player-status-enricher.ts:27, 231` and `apps/daemon/src/modules/game/game-detection.service.ts:6, 184`
      **Pattern:** cache-no-eviction
      **Description:** Both caches have working `cleanCache()` / TTL-on-read code but no production caller of the cleanup. `enrichmentCache` keys by `${steamId}:${ipAddress}` — grows with player + IP churn. `gameCache` keys by `${address}:${port}` — grows with infra churn (containerized servers with rotating IPs).
      **Growth/Impact:** Slow OOM over weeks. Tens to hundreds of thousands of entries per server.
      **Remediation:** Wire `cleanCache()` to a periodic interval owned by daemon shutdown. Or replace with bounded LRU.

### [WARNING] WARN-14 — Match handlers, weapon handlers, action handlers all discard `HandlerResult`

- [x] **File:** `apps/daemon/src/modules/match/match.events.ts:35-51, 99-102`; `apps/daemon/src/modules/weapon/weapon.events.ts:25-41`; `apps/daemon/src/modules/action/action.events.ts:39-87`
      **Pattern:** error-containment
      **Description:** Each service has correct `try/catch` returning `HandlerResult` with `success: false` on error. The event handlers await but never inspect the result — failures are invisible at the MQ ack boundary. RabbitMQ acks the message as if processed successfully; no redelivery, no metric.
      **Remediation:** `const result = await this.service.handleXEvent(...)`; `if (!result.success) throw new Error(result.error)`. Apply uniformly across all `*.events.ts` handlers.

### [WARNING] WARN-15 — Match state deleted before save completes (`finalizeMatch` swallow)

- [x] **File:** `apps/daemon/src/modules/match/match.service.ts:213-231, 270-291`
      **Pattern:** silent-catch, data-loss
      **Description:** `finalizeMatch` catches DB failures and logs only. The next line (`currentMatches.delete(serverId)`) wipes the in-memory state regardless. Failed write cannot be retried — round/scoring data lost.
      **Remediation:** Move `delete` after finalize succeeds; or persist incrementally so finalize is recoverable. Promote logger.failed → logger.error + metric.

### [WARNING] WARN-16 — Cache invalidation failures masked → stale data returned

- [x] **File:** `apps/daemon/src/modules/player/repositories/cached-player.repository.ts:151-169`
      **Pattern:** silent-catch
      **Description:** On `update()`, the cache invalidation Promise is wrapped in try/catch that only `warn`s. The caller sees success but subsequent reads return stale player stats — skill calculations on outdated values.
      **Remediation:** Either re-throw on invalidation failure (force handler retry) or use cache-aside with very short TTL and pessimistic reads.

### [WARNING] WARN-17 — Per-event GeoIP DB lookups in connect hot path with no cache

- [x] **File:** `apps/daemon/src/modules/geoip/geoip.service.ts:32-44` (called from `connect-event.handler.ts:117-123`)
      **Pattern:** nygard-antipattern (slow response, no integration timeout)
      **Description:** Every connect blocks on two sequential Prisma queries with no caching. On a server reboot (everyone reconnects), 30+ simultaneous slow GeoIP lookups stampede the DB.
      **Remediation:** Cache GeoIP lookups by IP (LRU, bounded). Verify DB indexes on `startIpNum`/`endIpNum`. Consider async/deferred enrichment.

### [WARNING] WARN-18 — Health endpoint trivially-true; doesn't verify MQ connection

- [x] **File:** `apps/daemon/src/main.ts:395-403`
      **Pattern:** error-containment (silent degradation)
      **Description:** `queueHealthy = !!this.context.queueModule` — only checks variable existence. After a connection drop, `RabbitMQClient.connection === null` but `/health` still returns "healthy".
      **Remediation:** Use `this.context.queueModule?.getStatus().connected ?? false`. Surface consumer state too.

### [WARNING] WARN-19 — `process.exit(0)` always returned, even on shutdown error

- [x] **File:** `apps/daemon/src/main.ts:424-430`
      **Pattern:** shutdown-order
      **Description:** `stop()` catches all errors, logs `logger.failed`, then `process.exit(0)`. Supervisor/Docker think shutdown succeeded.
      **Remediation:** `stop()` should rethrow or return status. Signal handler should `exit(success ? 0 : 1)`.

### [WARNING] WARN-20 — Concurrent `stop()` invocations not memoized

- [x] **File:** `apps/daemon/src/main.ts:303-332` and signal handler
      **Pattern:** signal-handler
      **Description:** No `shuttingDown` flag or memoized promise. A second SIGTERM (common in human-driven kills) re-enters `stop()` and double-closes Prisma, cache, MQ — which throw on the second call.
      **Remediation:** Memoize the shutdown promise; ignore signals after the first.

### [WARNING] WARN-21 — `node-cron` tasks `stop()`-ed but not `destroy()`-ed on shutdown

- [x] **File:** `apps/daemon/src/modules/rcon/schedulers/rcon-schedule.service.ts:155-166, 259`
      **Pattern:** timer-leak
      **Description:** Cron tasks paused but kept in node-cron internal registry. Harmless for normal process exit; matters in tests and any hot-reload scenario.
      **Remediation:** `task.destroy?.()` after `task.stop()`.

### [WARNING] WARN-22 — Excessive `recordHistogram`-style growth in `EventMetrics` (latent today)

- [x] **File:** `apps/daemon/src/shared/infrastructure/observability/event-metrics.ts:37-46, 117-170`
      **Pattern:** unbounded-collection (latent)
      **Description:** Class is constructed at `event-handler.orchestrator.ts:41` and threaded into every handler constructor, but `recordProcessingTime` / `recordError` are never called from production code today. Once wired up, the same defect as CRIT-13 applies (unbounded `Map<EventType, number[]>` + `Math.min(...times)` spread → `RangeError` past ~100k samples). The DB-pattern parallels CRIT-13 — fix together.
      **Remediation:** Either delete the class or rewrite as streaming aggregates before anyone wires it up. The bounded sampling pattern in `consumer.ts:68-69, 448-454` (cap at 1000 samples) is the model to copy.

---

### [INFO] INFO-1 — QueryBus / CachedQueryBus / CommandBus subpackage is dead code with latent setInterval leak

- [x] **File:** `apps/daemon/src/shared/application/cqrs/{query-bus,cached-query-bus,command-bus}.ts`
      **Pattern:** timer-leak (latent), dead-code
      **Description:** `CachedQueryBus` is only exported and `QueryBus` is only instantiated inside `CachedQueryBus`. Neither is referenced from any production wiring. `QueryBus.startCacheCleanup()` (line 226) discards the `setInterval` return value — even if activated, there's no way to cancel it. Currently has zero runtime impact but the API encourages future misuse.
      **Remediation:** Delete the subpackage, or implement `dispose()`/`shutdown()` on `QueryBus` and capture the timer handle.

### [INFO] INFO-2 — `PlayerHistoryService` is dead code (never instantiated)

- [x] **File:** `apps/daemon/src/modules/match/history.service.ts:11`
      **Description:** Class exists with `setInterval` lifecycle and `stop()`. No production caller.
      **Remediation:** Delete, or wire into the daemon.

### [INFO] INFO-3 — UDP server silently drops oversized packets; no metric

- [x] **File:** `apps/daemon/src/modules/ingress/udp-server.ts:94-96`
      **Description:** RT-009 oversize-drop is correct defense, but silent. A misconfigured server (fragmented logs re-assembled wrong) is invisible.
      **Remediation:** Increment `udp_oversize_drops` counter; rate-limited debug log by source IP.

### [INFO] INFO-4 — UDP socket has no `setRecvBufferSize` — kernel default applies

- [x] **File:** `apps/daemon/src/modules/ingress/udp-server.ts:89-125`
      **Description:** Default `net.core.rmem_default` ~212KB. Burst events beyond ~1400 packets silently drop at the network stack.
      **Remediation:** `socket.setRecvBufferSize(8 * 1024 * 1024)` and document in deployment requirements.

### [INFO] INFO-5 — UDP server binds to `0.0.0.0` by default

- [x] **File:** `apps/daemon/src/modules/ingress/udp-server.ts:83-87`
      **Description:** Without a network-level firewall, any internet host can send UDP. Trust model is "anyone who knows a token". No second line of defense.
      **Remediation:** Make `127.0.0.1` the default; require explicit `0.0.0.0` binding. Optional source-IP allowlist.

### [INFO] INFO-6 — Beacon path awaits `eventBus.emit()` per packet (blocks per-source ingress)

- [x] **File:** `apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts:142-151`
      **Description:** Slow `SERVER_AUTHENTICATED` subscriber (e.g., RCON connect) blocks beacon processing for that source.
      **Remediation:** If the emit is fire-and-forget by design: `void this.eventBus.emit(...).catch(...)`. Otherwise document why blocking is required.

### [INFO] INFO-7 — Beacon `validateToken` DB error bypasses rate-limiter

- [x] **File:** `apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts:83-115`
      **Description:** `validateToken` throws (DB down). Outer `handleLogLine` catches but the rate limiter isn't bumped. Attacker can probe with the same source IP indefinitely without triggering the block as long as the DB is unreachable.
      **Remediation:** Wrap `validateToken` in try/catch within `handleBeacon`; record failure to rate limiter on error.

### [INFO] INFO-8 — `parserCache` keyed by serverId never evicts

- [x] **File:** `apps/daemon/src/modules/ingress/ingress.service.ts:20, 240`
      **Description:** Bounded by total servers ever authenticated since daemon start. Small in practice (hundreds of bytes per entry). No eviction on server delete.
      **Remediation:** Hook into the CRIT-15 SERVER_SHUTDOWN cleanup chain.

### [INFO] INFO-9 — `DATABASE_URL` lacks documented pool tuning

- [x] **File:** `packages/db/env.example:4`
      **Description:** No `connection_limit` / `pool_timeout` documented. Pool defaults under burst load are easy to exhaust under contention.
      **Remediation:** Document recommended values sized to `EventConsumer.concurrency × avg_db_calls_per_event × 1.5`.

### [INFO] INFO-10 — `prisma.$transaction(callback)` lacks explicit timeout

- [x] **File:** `apps/daemon/src/database/client.ts:43-46`
      **Description:** Default `{ maxWait: 2000, timeout: 5000 }`. Under bursty writes + contention this is tight. Accept options arg.

### [INFO] INFO-11 — No schema-version check on startup

- [x] **File:** `apps/daemon/src/main.ts:150-174`
      **Description:** Migration drift surfaces as `Unknown column` at first event. Daemon happily runs against incompatible schema until first failure.
      **Remediation:** Query `_prisma_migrations` in preflight and compare against an embedded expected migration ID.

### [INFO] INFO-12 — Health-check `testConnection()` runs `SELECT 1` on every scrape

- [x] **File:** `apps/daemon/src/main.ts:101-105`
      **Description:** Prometheus scrapes every 15s + k8s probes contribute additional load. Cache result with 5s TTL.

### [INFO] INFO-13 — `garnet-cache.service.ts:212-229` uses `KEYS` + spread `DEL` for pattern invalidation

- [x] **File:** `apps/daemon/src/shared/infrastructure/caching/garnet-cache.service.ts:214`
      **Description:** `client.keys(pattern)` is O(N) over the full keyspace and blocks the Redis/Garnet server. `del(...keys)` spreads a potentially large list.
      **Remediation:** Use `SCAN` + batched `DEL` (or `UNLINK`).

---

## Stable patterns found (code worth preserving / templating)

- **`RabbitMQClient.isShuttingDown`** (client.ts:31, 79, 224, 263) correctly suppresses reconnect during shutdown. Good idea, properly applied.
- **`EventConsumer.metricsTimer`** (consumer.ts:124-127, 141-144) — stored on instance, cleared in `stop()`. Model for fixing other timer leaks.
- **Bounded sampling in `EventConsumer.processingTimes`** (consumer.ts:68-69, 448-454) — capped at 1000 with `shift()` on overflow. Template for fixing CRIT-13 and WARN-22.
- **`FragmentResponseHandler.cleanupAll()`** (fragment-response.handler.ts:155-165) — clears all `setTimeout` handles before clearing maps. Good model.
- **GoldSrc `cleanup()`** (goldsrc-rcon.protocol.ts:364-376) calls `socket.removeAllListeners()` AND wipes `this.rconPassword = ""`. Good — though it only runs on disconnect (see CRIT-14).
- **`RconService.disconnectAll`** (rcon.service.ts:197-214) — captures IDs first, uses `Promise.allSettled`, clears both maps after. Good shutdown model.
- **`NotificationConfigRepository`** (notification-config.repository.ts:69-71, 231-242) — TTL + per-server invalidation. Model for fixing the other unbounded caches.
- **`PlayerSessionRepository.addToIndexes`/`removeFromIndexes`** — exact mirrors; no index drift.
- **`ServerOrchestrator.pendingCreations`** (server-orchestrator.ts:67-69) — properly removes entries in `finally`.
- **`PlayerService.getOrCreatePlayer`** (player.service.ts:77-120) — request-level cache with promise dedup against concurrent resolution.
- **`GarnetCacheService`** always uses `setex` with TTL (garnet-cache.service.ts:110-114) — no in-process leak.
- **`PrismaTokenRepository` debounced `lastUsedAt` writes** (prisma-token.repository.ts:65-90) — anti-thundering-herd by design.
- **Discriminated unions in ingress** (`LineClassification`, `BeaconAuthResult`, `TokenValidationResult`) — force exhaustive handling.
- **`RabbitMQConsumer` parse failures** (consumer.ts:430) use `requeue=false` to prevent poison-pill loops.
- **`EventBus` per-handler error containment** (event-bus.ts:53-67) — one failing handler doesn't block siblings.

---

## Recommendations

### Quick wins (under a day each, high leverage)

- [x] **CRIT-1**: Remove `bufferHex` from GoldSrc debug log. 1-line change.
- [x] **CRIT-7**: Make `IngressService.stop()` async; await `udpServer.stop()`.
- [x] **CRIT-10**: Add `unhandledRejection` / `uncaughtException` handlers in main.ts.
- [x] **CRIT-11**: Wrap each shutdown phase in `Promise.race(phase, timeout)`.
- [x] **CRIT-12**: After 5 failed reconnects, switch to forever-poll with jitter, don't give up.
- [x] **WARN-18**: Replace `!!queueModule` with `queueModule.getStatus().connected`.
- [x] **WARN-19**: Return shutdown success state and use it for exit code.
- [x] **WARN-20**: Memoize shutdown promise.
- [x] **WARN-7**: Lower heartbeat to 10-15s.
- [x] **WARN-14**: Make handlers inspect `HandlerResult.success` and throw on failure.

### Medium (1-3 days each)

- [x] **CRIT-2/CRIT-3/CRIT-9**: Add `on('close')` / `on('error')` to `QueueChannel` adapter and consumer/publisher reset their cached channels. Re-subscribe consumers on reconnect. **This is the single highest-leverage change in the audit.**
- [x] **CRIT-8**: Track in-flight handler promises in `EventConsumer`; drain with timeout in shutdown.
- [x] **CRIT-13**: Replace homegrown `PrometheusMetricsExporter` with `prom-client` library (or rewrite to bucket-counter aggregation).
- [x] **CRIT-14**: Single `cleanup = () => { clearTimeout; off }` helper used by every reject path in GoldSrc RCON.
- [x] **WARN-1, WARN-13, WARN-2**: Periodic sweepers for the unbounded caches.
- [x] **WARN-3, WARN-6**: DLQ consumer + topology config wiring.

### Architectural (1+ week)

- [x] **CRIT-4 + CRIT-5**: Convert publisher to confirm channel; design a bounded local buffer + DLQ for unconfirmed messages. Pair with CRIT-6 redesign so retries don't dead-letter.
- [x] **CRIT-6**: Replace nack+setTimeout retry pattern with broker-side delayed-message plugin or in-flight scheduling that acks once republish is confirmed. Add `x-max-length` + DLQ consumer.
- [x] **CRIT-15**: Wire `SERVER_SHUTDOWN` to a coordinator that fans out cleanup across the 8+ modules holding per-server state. Add `SERVER_REMOVED` for admin deletions. Fold WARN-9 (RCON connection cleanup) into the same chain.
- [ ] **CRIT-8 part 2**: Audit handlers for idempotency. Add idempotency keys (event message ID) to writes that are not naturally idempotent (`EventFrag`, `EventEntry`, etc.).
- [x] **WARN-22**: Decide if the parallel `EventMetrics` system has a future; delete or rewrite as streaming aggregates.

---

## Provenance

Seven `daemon-resilience-scanner` sub-agents ran in parallel, one per scope (ingress, rcon, messaging, server-state, database+shutdown, shared-infrastructure, module-event-handlers). Combined raw output: ~55 CRITICALs, ~70 WARNINGs across all scanners.

Recalibration applied per the 3-part bar in the skill (realistic trigger + daemon-offline/data-loss blast + no compensating mechanism). 15 CRITICALs survived. Demotions (representative):

- **AuthRateLimiter / loggedMessages unbounded** (ingress scan C3/C4, server-state #7/#8): scanner rated CRITICAL claiming "minutes to OOM"; actual growth rate is bounded by unique source IPs × constant per-entry overhead, recoverable by restart, no in-flight subsystem wedged. Demoted to WARN-1.
- **ServerStateManager unbounded** (server-state #2/#3): the `startPeriodicCleanup()` and its discarded interval handle are dead code — never called in production. Real risk is "if activated, broken design"; current operational impact is bounded by # servers. Demoted to INFO/folded into CRIT-15.
- **EventMetrics unbounded arrays** (shared-infra): verified via grep — `recordProcessingTime` and `recordError` have **zero production call sites**. Latent only. Demoted to WARN-22.
- **QueryBus setInterval** (shared-infra): verified `CachedQueryBus` is only declared/exported, never instantiated. Demoted to INFO-1.
- **GameDetectionService.gameCache** (server-state #6): bounded by `# unique (address:port)` not per-event. Demoted to WARN-13.
- **Connect-event silent catches** (handlers #4–#6, #11): valid issues but recovery via DB retry / acceptable defaulting; demoted to WARN/INFO.

CRITICAL `bufferHex` password leak, channel-staleness chain (CRIT-2/CRIT-3/CRIT-9), shutdown bypass (CRIT-7/CRIT-8/CRIT-11), missing unhandled-rejection (CRIT-10), publisher-confirms gap (CRIT-4/CRIT-5/CRIT-6), reconnect surrender (CRIT-12), Prometheus exporter leak (CRIT-13), GoldSrc listener leak (CRIT-14), and SERVER_SHUTDOWN unwired (CRIT-15) were all verified against source before publishing.
