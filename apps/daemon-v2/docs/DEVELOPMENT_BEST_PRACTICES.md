# HLStats Next - Development Best Practices & Methodologies

## **Project Context & Objective**

We are rebuilding the legacy Perl-based HLstatsX daemon (located at `@/daemon`) from scratch as a modern TypeScript/Node.js microservice. The new daemon will collect, process, and aggregate statistics from Half-Life dedicated game servers (such as player stats, matches, maps, events, and more). This rewrite aims to provide a scalable, maintainable, and secure foundation for real-time game analytics, replacing the old HLstatsX Perl program with a robust, testable, and cloud-native solution.

## **Table of Contents**

1. [Architecture Principles](#architecture-principles)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing Strategies](#testing-strategies)
5. [Performance Guidelines](#performance-guidelines)
6. [Security Practices](#security-practices)
7. [Monitoring & Observability](#monitoring--observability)
8. [Deployment & Operations](#deployment--operations)
9. [Team Collaboration](#team-collaboration)

---

## **1. Architecture Principles**

### **1.1 Domain-Driven Design (DDD)**

Our system is organized around business domains:

```typescript
// ✅ GOOD: Clear domain boundaries
// packages/database/src/domains/player/player.service.ts
export class PlayerService {
  async calculateSkillRating(playerId: number): Promise<SkillRating> {
    // Domain logic encapsulated
  }
}

// ❌ BAD: Mixed concerns
// src/utils/everything.ts
export function calculatePlayerStuff() {
  // Database, business logic, and API concerns mixed
}
```

### **1.2 Clean Architecture Layers**

```
┌─────────────────────────────────────────────┐
│            Presentation Layer               │
│         (GraphQL, REST, WebSocket)          │
├─────────────────────────────────────────────┤
│            Application Layer                │
│          (Use Cases, DTOs)                  │
├─────────────────────────────────────────────┤
│             Domain Layer                    │
│      (Entities, Business Rules)            │
├─────────────────────────────────────────────┤
│          Infrastructure Layer               │
│      (Database, External APIs)             │
└─────────────────────────────────────────────┘
```

### **1.3 SOLID Principles**

**Single Responsibility**:

```typescript
// Each class has one reason to change
class EventProcessor {
  process(event: GameEvent): Promise<void> {
    // Only processes events
  }
}

class EventValidator {
  validate(event: GameEvent): ValidationResult {
    // Only validates events
  }
}
```

**Open/Closed**:

```typescript
// Open for extension, closed for modification
abstract class BaseParser {
  abstract parse(logLine: string): GameEvent;
}

class CS2Parser extends BaseParser {
  parse(logLine: string): GameEvent {
    // CS2-specific parsing
  }
}
```

**Dependency Inversion**:

```typescript
// Depend on abstractions, not concretions
interface IPlayerRepository {
  findById(id: number): Promise<Player>;
}

class PlayerService {
  constructor(private repo: IPlayerRepository) {}
  // Service doesn't know about database implementation
}
```

---

## **2. Development Workflow**

### **2.1 Git Workflow**

**Branch Naming Convention**:

```bash
feature/daemon-v2-event-processor
fix/player-stats-calculation
chore/update-dependencies
docs/api-documentation
```

**Commit Message Format**:

```
type(scope): subject

body

footer
```

**Examples**:

```bash
feat(daemon): add UDP server implementation

- Implemented high-performance UDP listener
- Added connection pooling
- Integrated with event queue

Closes #123

fix(api): correct player stats calculation

The K/D ratio was using integer division instead of float.
This fixes the precision issue reported by users.
```

### **2.2 Code Review Checklist**

- [ ] **Functionality**: Does it work as intended?
- [ ] **Tests**: Are there adequate tests?
- [ ] **Performance**: No obvious bottlenecks?
- [ ] **Security**: Input validation present?
- [ ] **Documentation**: Code and API documented?
- [ ] **Style**: Follows project conventions?
- [ ] **Dependencies**: Necessary and up-to-date?

### **2.3 Development Environment**

**Required Tools**:

```json
{
  "node": ">=20.0.0",
  "pnpm": ">=8.0.0",
  "docker": ">=24.0.0",
  "typescript": ">=5.0.0"
}
```

**VS Code Extensions**:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "graphql.vscode-graphql",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

---

## **3. Code Standards**

### **3.1 TypeScript Guidelines**

**Strict Type Safety**:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Type Definitions**:

```typescript
// ✅ GOOD: Explicit, reusable types
export interface PlayerStats {
  kills: number;
  deaths: number;
  headshots: number;
  accuracy: number;
}

// ❌ BAD: Inline, repetitive types
function getStats(): { k: number; d: number; hs: number; acc: number } {
  // ...
}
```

**Null Handling**:

```typescript
// ✅ GOOD: Explicit null handling
function getPlayer(id: number): Player | null {
  return players.find((p) => p.id === id) || null;
}

// ❌ BAD: Implicit undefined
function getPlayer(id: number) {
  return players.find((p) => p.id === id);
}
```

### **3.2 Error Handling**

**Custom Error Classes**:

```typescript
export class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PlayerNotFoundError extends DomainError {
  constructor(playerId: number) {
    super(`Player with ID ${playerId} not found`, "PLAYER_NOT_FOUND", 404);
  }
}
```

**Result Pattern**:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function updatePlayerStats(
  playerId: number,
  stats: Partial<PlayerStats>
): Promise<Result<Player, DomainError>> {
  try {
    const player = await playerRepo.update(playerId, stats);
    return { success: true, data: player };
  } catch (error) {
    return { success: false, error: new DomainError(...) };
  }
}
```

### **3.3 Async/Await Best Practices**

```typescript
// ✅ GOOD: Proper error handling
async function processEvents(events: GameEvent[]): Promise<void> {
  const results = await Promise.allSettled(
    events.map((event) => processEvent(event)),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    logger.error("Failed to process events", { failures });
  }
}

// ❌ BAD: Swallowing errors
async function processEvents(events: GameEvent[]): Promise<void> {
  await Promise.all(events.map((event) => processEvent(event).catch(() => {})));
}
```

---

## **4. Testing Strategies**

### **4.1 Test Pyramid**

```
         /\
        /  \  E2E Tests (10%)
       /    \  - Critical user paths
      /──────\  - Production-like environment
     /        \
    /          \  Integration Tests (30%)
   /            \  - API endpoints
  /──────────────\  - Database operations
 /                \  - Service interactions
/                  \
──────────────────── Unit Tests (60%)
                     - Business logic
                     - Utilities
                     - Validators
```

### **4.2 Unit Testing**

**Test Structure (AAA Pattern)**:

```typescript
describe("PlayerService", () => {
  describe("calculateSkillRating", () => {
    it("should increase rating for wins", async () => {
      // Arrange
      const player = createMockPlayer({ rating: 1000 });
      const match = createMockMatch({ winner: player.id });

      // Act
      const newRating = await service.calculateSkillRating(player, match);

      // Assert
      expect(newRating).toBeGreaterThan(player.rating);
      expect(newRating).toBeLessThan(player.rating + 50);
    });
  });
});
```

**Mock Strategies**:

```typescript
// Database mocks
const mockPrisma = {
  player: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

// External service mocks
vi.mock("@/services/steam-api", () => ({
  fetchPlayerInfo: vi.fn().mockResolvedValue({
    steamId: "123",
    avatar: "url",
  }),
}));
```

### **4.3 Integration Testing**

**API Testing**:

```typescript
describe("POST /api/events", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should process valid game event", async () => {
    const event = {
      type: "player_kill",
      timestamp: new Date().toISOString(),
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: {
        Authorization: "Bearer valid-token",
      },
      payload: event,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: expect.any(String),
      processed: true,
    });
  });
});
```

### **4.4 E2E Testing**

```typescript
// e2e/player-statistics.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Player Statistics", () => {
  test("should display real-time stats updates", async ({ page }) => {
    // Navigate to player profile
    await page.goto("/players/123");

    // Check initial stats
    const killCount = await page.locator('[data-testid="kill-count"]');
    await expect(killCount).toHaveText("50");

    // Simulate game event via WebSocket
    await page.evaluate(() => {
      window.ws.send(
        JSON.stringify({
          type: "player_kill",
          playerId: 123,
        }),
      );
    });

    // Verify real-time update
    await expect(killCount).toHaveText("51");
  });
});
```

### **4.5 Test Data Management**

**Factories**:

```typescript
// tests/factories/player.factory.ts
export const playerFactory = Factory.define<Player>(() => ({
  id: faker.number.int(),
  name: faker.internet.userName(),
  steamId: faker.string.numeric(17),
  rating: faker.number.int({ min: 0, max: 3000 }),
  createdAt: faker.date.past(),
}));

// Usage
const player = playerFactory.build({ rating: 1500 });
const players = playerFactory.buildList(10);
```

**Fixtures**:

```typescript
// tests/fixtures/database.ts
export async function seedTestDatabase() {
  await prisma.$transaction([
    prisma.player.createMany({ data: testPlayers }),
    prisma.server.createMany({ data: testServers }),
    prisma.gameEvent.createMany({ data: testEvents }),
  ]);
}

export async function cleanupDatabase() {
  await prisma.$transaction([
    prisma.gameEvent.deleteMany(),
    prisma.player.deleteMany(),
    prisma.server.deleteMany(),
  ]);
}
```

---

## **5. Performance Guidelines**

### **5.1 Database Optimization**

**Query Performance**:

```typescript
// ✅ GOOD: Efficient queries with proper indexes
const topPlayers = await prisma.player.findMany({
  where: {
    lastSeenAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  orderBy: { rating: "desc" },
  take: 100,
  select: {
    id: true,
    name: true,
    rating: true,
    stats: {
      select: {
        kills: true,
        deaths: true,
      },
    },
  },
});

// ❌ BAD: N+1 queries
const players = await prisma.player.findMany();
for (const player of players) {
  const stats = await prisma.playerStats.findUnique({
    where: { playerId: player.id },
  });
}
```

**Connection Pooling**:

```typescript
// prisma/client.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ["error", "warn"],
  // Connection pool configuration
  // These are managed by the underlying engine
});

// Ensure proper cleanup
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
```

### **5.2 Caching Strategies**

**Multi-Level Caching**:

```typescript
class CacheManager {
  private memoryCache = new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit) return memoryHit;

    // L2: Redis cache
    const redisHit = await this.redis.get(key);
    if (redisHit) {
      const data = JSON.parse(redisHit);
      this.memoryCache.set(key, data);
      return data;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || 3600; // 1 hour default

    // Set in both caches
    this.memoryCache.set(key, value);
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }
}
```

**Cache Invalidation**:

```typescript
class PlayerCacheService {
  async invalidatePlayer(playerId: number): Promise<void> {
    const patterns = [
      `player:${playerId}:*`,
      `leaderboard:*`,
      `stats:global:*`,
    ];

    // Clear from all cache levels
    await Promise.all([
      this.clearMemoryCache(patterns),
      this.clearRedisCache(patterns),
    ]);

    // Publish invalidation event
    await this.pubsub.publish("cache.invalidate", {
      type: "player",
      id: playerId,
      patterns,
    });
  }
}
```

### **5.3 Async Processing**

**Event Queue Management**:

```typescript
// Queue configuration with backpressure
const eventQueue = new Queue("game-events", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Worker with concurrency control
const worker = new Worker(
  "game-events",
  async (job) => {
    await processGameEvent(job.data);
  },
  {
    connection: redis,
    concurrency: 50,
    limiter: {
      max: 100,
      duration: 1000, // 100 jobs per second
    },
  },
);
```

---

## **6. Security Practices**

### **6.1 Input Validation**

**Zod Schemas**:

```typescript
// Comprehensive validation schemas
export const PlayerUpdateSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid characters in name"),
  email: z.string().email().optional(),
  settings: z
    .object({
      notifications: z.boolean(),
      privacy: z.enum(["public", "friends", "private"]),
    })
    .optional(),
});

// API endpoint validation
app.post("/api/players/:id", async (req, res) => {
  const validation = PlayerUpdateSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.error.flatten(),
    });
  }

  // Process validated data
  await updatePlayer(req.params.id, validation.data);
});
```

### **6.2 Authentication & Authorization**

**JWT Implementation**:

```typescript
// Token generation with proper claims
export function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "1h",
      issuer: "hlstats-api",
      audience: "hlstats-client",
    },
  );
}

// Middleware with role-based access
export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !user.roles.includes(role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        required: role,
      });
    }

    next();
  };
}
```

### **6.3 SQL Injection Prevention**

```typescript
// ✅ GOOD: Parameterized queries
const players = await prisma.$queryRaw`
  SELECT * FROM players 
  WHERE server_id = ${serverId} 
  AND last_seen > ${minDate}
`;

// ❌ BAD: String concatenation
const players = await prisma.$queryRawUnsafe(
  `SELECT * FROM players WHERE name = '${userName}'`,
);
```

### **6.4 Rate Limiting**

```typescript
// IP-based rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl",
  points: 100, // requests
  duration: 60, // per minute
  blockDuration: 60 * 5, // block for 5 minutes
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 60,
    });
  }
});
```

---

## **7. Monitoring & Observability**

### **7.1 Structured Logging**

**Log Levels & Context**:

```typescript
// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: "hlstats-daemon",
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Contextual logging
logger.info("Player action processed", {
  playerId: player.id,
  action: "kill",
  weapon: event.weapon,
  serverId: server.id,
  processingTime: Date.now() - startTime,
});
```

### **7.2 Metrics Collection**

**Prometheus Metrics**:

```typescript
// Define metrics
const metrics = {
  httpRequestDuration: new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),

  activeConnections: new Gauge({
    name: "websocket_active_connections",
    help: "Number of active WebSocket connections",
  }),

  eventsProcessed: new Counter({
    name: "game_events_processed_total",
    help: "Total number of game events processed",
    labelNames: ["event_type", "game", "status"],
  }),
};

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;

    metrics.httpRequestDuration
      .labels(req.method, req.route?.path || "unknown", res.statusCode)
      .observe(duration);
  });

  next();
});
```

### **7.3 Distributed Tracing**

```typescript
// OpenTelemetry setup
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "hlstats-daemon",
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
  }),
});

// Instrument operations
export async function processEvent(event: GameEvent): Promise<void> {
  const span = tracer.startSpan("processEvent", {
    attributes: {
      "event.type": event.type,
      "event.server_id": event.serverId,
    },
  });

  try {
    await validateEvent(event);
    await storeEvent(event);
    await updateStatistics(event);

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## **8. Deployment & Operations**

### **8.1 CI/CD Pipeline**

**GitHub Actions Workflow**:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 21.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: pnpm audit --audit-level=high

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to production
        uses: ./.github/actions/deploy
        with:
          environment: production
          version: ${{ github.sha }}
```

### **8.2 Container Best Practices**

**Multi-Stage Dockerfile**:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package files
COPY apps/daemon-v2/package.json ./apps/daemon-v2/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm --filter @hlstatsnext/daemon-v2 build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/daemon-v2/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### **8.3 Health Checks**

```typescript
// healthcheck.ts
export async function healthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemoryUsage(),
    disk: await checkDiskSpace(),
  };

  const allHealthy = Object.values(checks).every((check) => check.healthy);

  return {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    checks,
  };
}

// Health check endpoint
app.get("/health", async (req, res) => {
  const health = await healthCheck();
  const statusCode = health.status === "healthy" ? 200 : 503;

  res.status(statusCode).json(health);
});

// Readiness check
app.get("/ready", async (req, res) => {
  const ready = await isServiceReady();

  if (ready) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});
```

---

## **9. Team Collaboration**

### **9.1 Documentation Standards**

**Code Documentation**:

```typescript
/**
 * Calculates the skill rating adjustment based on match outcome.
 * Uses a modified Elo rating system with K-factor adjustments.
 *
 * @param winner - The winning player
 * @param loser - The losing player
 * @param matchDetails - Additional match context (map, weapon, etc.)
 * @returns Rating adjustments for both players
 *
 * @example
 * const adjustments = calculateRatingChange(
 *   { rating: 1500, matches: 100 },
 *   { rating: 1400, matches: 50 },
 *   { headshot: true }
 * );
 * // Returns: { winner: +25, loser: -20 }
 */
export function calculateRatingChange(
  winner: Player,
  loser: Player,
  matchDetails?: MatchContext,
): RatingAdjustment {
  // Implementation
}
```

**API Documentation**:

```typescript
/**
 * @route GET /api/players/:id/stats
 * @summary Get player statistics
 * @param {string} id.path.required - Player ID
 * @param {string} timeframe.query - Time period (day|week|month|all)
 * @param {string} gameMode.query - Game mode filter
 * @returns {PlayerStats} 200 - Player statistics
 * @returns {Error} 404 - Player not found
 * @security JWT
 */
```

### **9.2 Code Review Guidelines**

**Review Checklist**:

```markdown
## Code Review Checklist

### Functionality

- [ ] Code accomplishes the intended goal
- [ ] Edge cases are handled
- [ ] Error scenarios are covered

### Code Quality

- [ ] Follows project coding standards
- [ ] No code duplication
- [ ] Clear variable/function names
- [ ] Appropriate abstractions

### Testing

- [ ] Unit tests for new functionality
- [ ] Integration tests for API changes
- [ ] Test coverage maintained or improved

### Performance

- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] Caching used appropriately

### Security

- [ ] Input validation present
- [ ] No sensitive data exposed
- [ ] Authentication/authorization correct

### Documentation

- [ ] Code comments where needed
- [ ] API documentation updated
- [ ] README updated if needed
```

### **9.3 Knowledge Sharing**

**ADR (Architecture Decision Records)**:

```markdown
# ADR-001: Use Redis for Event Queue

## Status

Accepted

## Context

We need a reliable message queue for processing game events with high throughput.

## Decision

We will use Redis with Bull MQ for the event processing queue.

## Consequences

### Positive

- High performance and low latency
- Built-in retry mechanisms
- Good TypeScript support

### Negative

- Additional infrastructure dependency
- Need to manage Redis persistence

## Alternatives Considered

- RabbitMQ: More complex, overkill for our needs
- AWS SQS: Vendor lock-in, higher latency
- In-memory queue: No persistence, single point of failure
```

---

## **Appendix: Quick Reference**

### **Common Commands**

```bash
# Development
pnpm dev                    # Start all services in dev mode
pnpm test                   # Run tests
pnpm build                  # Build all packages
pnpm lint                   # Run linting
pnpm typecheck             # Run TypeScript checks

# Database
pnpm db:migrate            # Run migrations
pnpm db:seed               # Seed database
pnpm db:studio             # Open Prisma Studio

# Docker
docker-compose up -d       # Start services
docker-compose logs -f     # View logs
docker-compose down        # Stop services

# Production
pnpm start                 # Start production server
pnpm pm2:start            # Start with PM2
pnpm pm2:logs             # View PM2 logs
```

### **Environment Variables**

```bash
# Required
NODE_ENV=production
DATABASE_URL=mysql://user:pass@host:3306/hlstats
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key

# Optional
LOG_LEVEL=info
SENTRY_DSN=https://...
PROMETHEUS_PORT=9090
ENABLE_TRACING=true
```

### **Troubleshooting**

```bash
# Clear all caches
pnpm clean

# Rebuild dependencies
pnpm install --force

# Reset database
pnpm db:reset

# Check service health
curl http://localhost:3000/health

# View real-time metrics
open http://localhost:9090/metrics
```

---

This guide is a living document. Please contribute improvements and lessons learned!
