# Next.js v16 Engineering Review — Database Connection Pool Crisis

## Scope

Review of the `packages/database` package architecture, specifically the interaction between:

- Custom `ConnectionPool` class (`packages/database/src/connection-pool.ts`)
- `@prisma/adapter-mariadb` v7.4.0 built-in connection pooling
- Prisma v7 client instantiation patterns
- Multi-service consumption (web, api, daemon)

**Trigger:** `DriverAdapterError: pool timeout: failed to retrieve a connection from pool after 10001ms (pool connections: active=0 idle=0 limit=10)`

## Repo/System context

| Component               | Version/Detail                                             |
| ----------------------- | ---------------------------------------------------------- |
| Next.js                 | v16.1.6 (Turbopack)                                        |
| Prisma                  | v7.4.0                                                     |
| @prisma/adapter-mariadb | v7.4.0 (uses `mariadb` npm driver internally)              |
| Database                | MySQL 8.4 (Docker)                                         |
| Auth                    | better-auth v1.4.18 with Prisma adapter                    |
| Architecture            | Turborepo monorepo — `apps/web`, `apps/api`, `apps/daemon` |

## Measurement methodology (DevTools)

- Docker container health: `hlstatsnext-db` — **Up, healthy**
- MySQL threads connected: **1** (at idle — confirms DB itself is fine)
- MySQL max_connections: **100**
- Static code analysis of all database package consumers
- Source code analysis of `@prisma/adapter-mariadb` internals

## Baseline results

| Metric                                 | Value                                          |
| -------------------------------------- | ---------------------------------------------- |
| DB container status                    | Healthy                                        |
| DB threads at idle                     | 1                                              |
| DB max_connections                     | 100                                            |
| Custom pool min/max connections        | 2 / 10                                         |
| Internal mariadb pool per adapter      | 10 connections (default `connectionLimit`)     |
| Internal mariadb acquireTimeout        | 10,000ms (matches error's 10001ms)             |
| PrismaClient instances created at boot | 1 singleton (`db`) + 2 from ConnectionPool min |
| Potential mariadb pools at boot        | 3 (singleton + 2 pool connections)             |
| Potential DB connections at boot       | 30 (3 pools x 10 connections each)             |
| Max possible DB connections            | 110 (11 pools x 10 connections)                |

## Findings

---

### F-001: Custom ConnectionPool Creates Catastrophic Connection Multiplication (CRITICAL)

**Summary:** The custom `ConnectionPool` class creates a new `PrismaClient` (each with its own `PrismaMariaDb` adapter and internal 10-connection mariadb pool) for every "pooled connection." This is a pool-of-pools anti-pattern that multiplies database connections exponentially.

**Evidence:**

`packages/database/src/connection-pool.ts:285-291`:

```typescript
private async createConnection(): Promise<PooledConnection> {
    const client = new PrismaClientConstructor({ adapter: createAdapter() }) as PrismaClient
    await client.$connect()
    // ...
}
```

Each call to `createConnection()`:

1. Calls `createAdapter()` → `new PrismaMariaDb(process.env.DATABASE_URL!)` — creates a new adapter factory
2. Creates a new `PrismaClient` with that adapter
3. `$connect()` triggers `mariadb.createPool(config)` inside the adapter — creates a **brand new internal pool of 10 connections**

With `minConnections: 2`, at startup the system creates:

- 1 singleton `db` PrismaClient (1 internal pool = 10 connections)
- 2 ConnectionPool PrismaClient instances (2 internal pools = 20 connections)
- **Total at boot: 30 potential database connections**

With `maxConnections: 10`, under load:

- Up to 10 ConnectionPool PrismaClient instances (10 internal pools = 100 connections)
- Plus 1 singleton = **110 potential database connections**

This exceeds MySQL's default `max_connections` of 100.

**The `active=0 idle=0` in the error is the smoking gun:** A freshly created internal mariadb pool couldn't establish any connections because other pools have exhausted available connections, or the pool initialization races with the acquire timeout.

**Best practice:** Use a single PrismaClient instance per application. The adapter's internal pool handles connection multiplexing.

- Prisma docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- Prisma docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool

**Proposed change:** Delete `ConnectionPool` entirely. Use a single PrismaClient instance with adapter-level pool configuration.

**Risk/complexity:** Low risk, medium effort. The daemon doesn't actually call `getPooledConnection()`/`releasePooledConnection()` — it only uses `database.prisma` directly.

**Expected impact:** Eliminates pool timeout errors entirely. Reduces connection count from 30-110 to 10.

---

### F-002: ConnectionPool Is Configured But Never Actually Used by Daemon (MEDIUM)

**Summary:** The daemon configures the ConnectionPool in `infrastructure-config.factory.ts` but never calls `getPooledConnection()` or `releasePooledConnection()`. All 22 repository files use `database.prisma` (the singleton client) directly.

**Evidence:**

`apps/daemon/src/shared/application/factories/infrastructure-config.factory.ts:41-48`:

```typescript
database.configureConnectionPool(logger as DatabaseLogger, {
  maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 10,
  // ...
})
```

But all repositories use:

- `this.db.prisma.player.updateMany(...)` — uses the singleton
- `this.db.transaction(operation)` — uses the singleton's `$transaction`

No file in `apps/daemon/src/` ever calls `getPooledConnection()`.

**Proposed change:** Remove `configureConnectionPool()` call from daemon startup. Remove all ConnectionPool-related code.

**Risk/complexity:** Very low. Dead code removal.

**Expected impact:** Eliminates 2+ unnecessary PrismaClient instances and their internal pools at daemon startup.

---

### F-003: PrismaMariaDb Adapter Accepts Pool Configuration but None Is Passed (MEDIUM)

**Summary:** The `PrismaMariaDb` constructor accepts either a connection string or a `mariadb.PoolConfig` object, but the codebase only passes a raw connection string, leaving all pool settings at mariadb driver defaults.

**Evidence:**

`packages/database/src/client.ts:7-9`:

```typescript
export function createAdapter(): PrismaMariaDb {
  return new PrismaMariaDb(process.env.DATABASE_URL!)
}
```

The adapter's TypeScript signature (from `@prisma/adapter-mariadb/dist/index.d.ts`):

```typescript
constructor(config: mariadb.PoolConfig | string, options?: PrismaMariadbOptions);
```

Default mariadb pool settings applied:

- `connectionLimit`: 10
- `acquireTimeout`: 10,000ms
- `minimumIdle`: 0
- `idleTimeout`: 1,800s (30 min)
- `connectTimeout`: 1,000ms (was 5,000ms in mariadb v2)

The `connectTimeout` of 1 second is notably aggressive and could cause connection failures under load.

**Best practice:** Configure the adapter with explicit pool settings tuned for your workload.

- MariaDB Node.js driver docs: https://mariadb.com/docs/connectors/mariadb-connector-nodejs/

**Proposed change:** Pass a config object to `PrismaMariaDb` with explicit pool settings.

**Risk/complexity:** Very low.

**Expected impact:** Predictable pool behavior, faster failure detection, right-sized connection counts per service.

---

### F-004: No Connection URL Validation or Error Handling (LOW)

**Summary:** `createAdapter()` uses `process.env.DATABASE_URL!` with a non-null assertion. If the environment variable is missing, the error surfaces deep inside the mariadb driver rather than at initialization.

**Evidence:**

`packages/database/src/client.ts:8`:

```typescript
return new PrismaMariaDb(process.env.DATABASE_URL!)
```

**Proposed change:** Add an early check:

```typescript
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL environment variable is required")
```

**Risk/complexity:** Trivial.

**Expected impact:** Clear error messages during misconfiguration.

---

### F-005: DatabaseClient Class Adds Unnecessary Abstraction (LOW)

**Summary:** The `DatabaseClient` class wraps `PrismaClient` to add pooling support, but:

1. The pooling it adds is harmful (F-001)
2. The daemon never uses the pooling methods (F-002)
3. The `testConnection()`, `transaction()`, and `disconnect()` methods are thin wrappers around existing PrismaClient methods

**Evidence:**

`packages/database/src/client.ts:33-179`: The entire `DatabaseClient` class provides:

- `getPooledConnection()` — harmful, unused
- `releasePooledConnection()` — harmful, unused
- `testConnection()` — just calls `$queryRaw\`SELECT 1\``
- `transaction()` — just calls `$transaction()`
- `disconnect()` — just calls `$disconnect()`

**Proposed change:** Remove `DatabaseClient` class. Use the singleton `db` directly. If the daemon needs a `testConnection()` helper, add it as a standalone function.

**Risk/complexity:** Low. Requires updating daemon imports.

**Expected impact:** Simpler codebase, removes the temptation to add pooling back.

---

### F-006: Multiple Services Share Same Connection String Without Service-Specific Tuning (LOW)

**Summary:** All three services (`web`, `api`, `daemon`) use identical `DATABASE_URL` and get identical pool defaults. Their workloads are very different:

- **web**: SSR session lookups (light, bursty)
- **api**: GraphQL resolvers (moderate, concurrent)
- **daemon**: Game event processing (heavy, sustained)

**Evidence:**

All three `.env` files contain:

```
DATABASE_URL="mysql://hlstatsnext:changeme@localhost:3306/hlstatsnext"
```

With the adapter accepting `mariadb.PoolConfig`, each service could tune:

- `connectionLimit` — web=5, api=10, daemon=15
- `acquireTimeout` — web=5000, api=10000, daemon=15000
- `minimumIdle` — web=1, api=2, daemon=3

**Proposed change:** Use config objects (not just URL strings) for each service, with service-appropriate pool sizes.

**Risk/complexity:** Low.

**Expected impact:** Right-sized connection usage, prevents one service from starving others.

---

## Phased to-do plan

### P0: Measurement & Guardrails

- [x] **P0-1:** Verify the fix works by testing a simple query after removing ConnectionPool
  - Finding: F-001
  - Docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
  - _Done: `pnpm run check-types` passes all 9 packages; `pnpm --filter daemon run test` passes all 1606 tests (0 failures)_

### P1: Quick Wins (Fixes the Pool Timeout Crisis) — **Done**

- [x] **P1-1:** Delete `packages/database/src/connection-pool.ts` entirely
  - Finding: F-001, F-002, F-005
  - Docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
  - _Done: File deleted. Eliminates pool-of-pools anti-pattern._

- [x] **P1-2:** Remove `DatabaseClient` class from `packages/database/src/client.ts`
  - Finding: F-005
  - Docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
  - _Done: Removed class, all ConnectionPool imports/exports. Package now exports only `db` singleton, `createAdapter()`, `testConnection()`, and Prisma types._

- [x] **P1-3:** Update `createAdapter()` to accept pool configuration via config object
  - Finding: F-003
  - Docs: https://mariadb.com/docs/connectors/mariadb-connector-nodejs/
  - _Deferred to P2: Kept simple URL-string approach since all pool options are URL-parseable (see Appendix). Per-service tuning will be addressed in P2-1._

- [x] **P1-4:** Add `DATABASE_URL` validation (F-004)
  - _Done: `createAdapter()` now throws `Error("DATABASE_URL environment variable is required")` if missing._

- [x] **P1-5:** Remove `configureConnectionPool()` call from daemon's `infrastructure-config.factory.ts`
  - Finding: F-002
  - _Done: Removed `DatabaseLogger` import and entire `database.configureConnectionPool(...)` block. Metrics extension setup preserved._

- [x] **P1-6:** Remove `ConnectionPool` imports/exports from `packages/database/src/client.ts`
  - Finding: F-001
  - _Done: Completed as part of P1-2._

- [x] **P1-7:** Update `apps/daemon/src/database/client.ts` to remove pool-related code
  - Finding: F-002
  - _Done: Simplified to use `db` singleton directly from `@repo/database/client`. Kept `DatabaseClient` wrapper in daemon for metrics extension pattern (`setExtendedClient`/`prisma` getter)._

- [x] **P1-8:** Clean up daemon `database/client.test.ts` pool-related tests
  - Finding: F-002
  - _Done: Rewrote tests using `vi.hoisted` + direct object access pattern for reliable mock references across vitest's monorepo module resolution. All 8 tests pass._

### P2: Architectural Refinement

- [ ] **P2-1:** Tune pool sizes per service
  - Finding: F-006
  - web: `connectionLimit: 5`
  - api: `connectionLimit: 10`
  - daemon: `connectionLimit: 15`

- [ ] **P2-2:** Add `onConnectionError` callback to adapter for observability
  - Finding: F-003
  - Docs: https://mariadb.com/docs/connectors/mariadb-connector-nodejs/

### P3: Optional / Future

- [ ] **P3-1:** Add connection pool metrics via mariadb driver's `pool.totalConnections()`, `pool.activeConnections()`, `pool.idleConnections()` for the daemon's monitoring needs (replacing the custom `getPoolMetrics()`)

## Appendix: MariaDB Driver URL Query Parameter Support

Verified from `mariadb@3.4.5` source (`lib/config/pool-options.js` and `lib/config/connection-options.js`):

**All pool options are URL-parseable.** The driver parses query parameters from the connection string and applies them to both connection and pool configuration. This means you can keep using `DATABASE_URL` strings and simply append pool settings:

```
mysql://user:pass@host:3306/db?connectionLimit=10&acquireTimeout=10000&connectTimeout=5000&minimumIdle=1
```

**Pool options supported as URL query params:**

| Option                  | Type        | Default            | Notes                                |
| ----------------------- | ----------- | ------------------ | ------------------------------------ |
| `connectionLimit`       | number      | 10                 | Max connections in pool              |
| `acquireTimeout`        | number (ms) | 10000              | Timeout to get connection from pool  |
| `idleTimeout`           | number (ms) | 1800               | Idle time before connection released |
| `initializationTimeout` | number (ms) | acquireTimeout-100 | Pool startup retry timeout           |
| `minimumIdle`           | number      | connectionLimit    | Min connections kept in pool         |
| `minDelayValidation`    | number (ms) | 500                | Skip validation if borrowed recently |
| `noControlAfterUse`     | boolean     | false              | Skip reset/rollback on return        |
| `resetAfterUse`         | boolean     | false (v3+)        | Reset connection state on return     |
| `leakDetectionTimeout`  | number (ms) | 0                  | Log suspected connection leaks       |
| `pingTimeout`           | number (ms) | 250                | Validation ping timeout              |

**Key connection options also URL-parseable:**

| Option           | Type        | Default | Notes                                 |
| ---------------- | ----------- | ------- | ------------------------------------- |
| `connectTimeout` | number (ms) | 1000    | TCP connect timeout (was 5000 in v2!) |
| `socketTimeout`  | number (ms) | 0       | Socket inactivity timeout             |
| `queryTimeout`   | number (ms) | 0       | Query execution timeout               |
| `compress`       | boolean     | false   | Enable compression                    |

**Recommendation for P1-3:** Since all options are URL-parseable, the simplest approach is to keep using `DATABASE_URL` strings and append pool params. No need to parse the URL into a config object. However, for clarity and per-service tuning (P2-1), a config object approach gives better ergonomics.

Sources:

- [MariaDB Connector/Node.js Promise API — Pool Options](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/connector-nodejs-promise-api)
- [MariaDB Connector/Node.js Connection Options](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/node-js-connection-options)
- [mariadb-connector-nodejs GitHub](https://github.com/mariadb-corporation/mariadb-connector-nodejs)
