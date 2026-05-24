// Load environment variables first
import "dotenv/config"

import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit"
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection"
import { createYoga } from "graphql-yoga"
import { createServer } from "node:http"
import { createContext } from "./context"
import { schema } from "./pothos-schema"

const isProduction = process.env.NODE_ENV === "production"

// Production must have FRONTEND_URL set — otherwise CORS origin becomes
// `undefined`, which echoes back the request Origin and allows any site
// to ride a logged-in user's Better Auth cookie into admin mutations.
if (isProduction && !process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL environment variable is required in production")
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
