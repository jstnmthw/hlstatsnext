// Load environment variables first
import "dotenv/config"

import { usePrometheus } from "@envelop/prometheus"
import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit"
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection"
import { createYoga } from "graphql-yoga"
import { createServer } from "node:http"
import { Registry, collectDefaultMetrics } from "prom-client"
import { createContext } from "./context"
import { schema } from "./pothos-schema"

const isProduction = process.env.NODE_ENV === "production"

// Production must have FRONTEND_URL set — otherwise CORS origin becomes
// `undefined`, which echoes back the request Origin and allows any site
// to ride a logged-in user's Better Auth cookie into admin mutations.
if (isProduction && !process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL environment variable is required in production")
}

const metricsEnabled = parseBooleanEnv(process.env.METRICS_ENABLED)

// ─── Metrics setup ──────────────────────────────────────────────────────────
// Building the Registry, the Envelop plugin, and the sibling /metrics listener
// is gated entirely behind METRICS_ENABLED so the GraphQL request path has
// zero observability overhead when telemetry is off.
const metricsRegistry = metricsEnabled ? new Registry() : null
if (metricsRegistry) {
  collectDefaultMetrics({ register: metricsRegistry })
}

// ─── Security plugins ───────────────────────────────────────────────────────
const plugins = [
  // Prevent DoS via deeply nested queries on bidirectional relations
  maxDepthPlugin({ n: 7 }),
  // Prevent DoS via wide queries (large `take`, many fields, recursive selection)
  costLimitPlugin({
    maxCost: 5000,
    objectCost: 2,
    scalarCost: 1,
    depthCostFactor: 1.5,
    ignoreIntrospection: true,
  }),
  // Hide schema structure from attackers in production
  ...(isProduction ? [useDisableIntrospection()] : []),
  // Prometheus telemetry: request count, duration, errors, parse/validate/execute
  // timings. Resolver-level timings stay off — they generate a metric per field
  // and degrade hot paths. Re-enable selectively via `resolversWhitelist`.
  ...(metricsRegistry
    ? [
        usePrometheus({
          registry: metricsRegistry,
          skipIntrospection: true,
          metrics: {
            graphql_envelop_request: true,
            graphql_envelop_request_duration: true,
            graphql_envelop_phase_parse: true,
            graphql_envelop_phase_validate: true,
            graphql_envelop_phase_execute: true,
            graphql_envelop_error_result: true,
          },
        }),
      ]
    : []),
]

// Create GraphQL Yoga server
const yoga = createYoga({
  schema,
  landingPage: false,
  graphqlEndpoint: "/graphql",
  graphiql: !isProduction,
  context: createContext,
  plugins,
  // Mask internal error details in production
  maskedErrors: isProduction,
  cors: {
    origin: isProduction ? process.env.FRONTEND_URL : "http://localhost:3000",
    credentials: true,
  },
})

// Create HTTP server
const server = createServer(yoga)

const port = process.env.PORT || 4000

server.listen(port, () => {
  console.log(`🚀 GraphQL API server ready at http://localhost:${port}/graphql`)
  if (!isProduction) {
    console.log(`📊 GraphiQL interface available at http://localhost:${port}/graphql`)
  }
})

// ─── Optional sibling metrics endpoint ──────────────────────────────────────
// Lives on a dedicated port so it can be locked to an internal interface in
// production without exposing GraphQL telemetry on the public listener.
let metricsServer: ReturnType<typeof createServer> | null = null
if (metricsRegistry) {
  const metricsPort = Number(process.env.API_METRICS_PORT) || 9092
  metricsServer = createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found")
      return
    }
    try {
      const body = await metricsRegistry.metrics()
      res.writeHead(200, { "Content-Type": metricsRegistry.contentType })
      res.end(body)
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" })
      res.end(error instanceof Error ? error.message : String(error))
    }
  })
  metricsServer.listen(metricsPort, () => {
    console.log(`📈 Metrics endpoint ready at http://localhost:${metricsPort}/metrics`)
  })
}

// Graceful shutdown: close both listeners so a SIGTERM doesn't leave the
// metrics port bound across restarts.
function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}, shutting down API server...`)
  server.close()
  metricsServer?.close()
}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
}
