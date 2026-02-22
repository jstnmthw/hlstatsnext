// Load environment variables first
import "dotenv/config"

import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection"
import { createYoga } from "graphql-yoga"
import { createServer } from "node:http"
import { createContext } from "./context"
import { schema } from "./pothos-schema"

const isProduction = process.env.NODE_ENV === "production"

// ─── Security plugins (RT-003, RT-004) ──────────────────────────────────────
const plugins = [
  // RT-003: Prevent DoS via deeply nested queries on bidirectional relations
  maxDepthPlugin({ n: 7 }),
  // RT-004: Hide schema structure from attackers in production
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
  // RT-004: Mask internal error details in production
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
