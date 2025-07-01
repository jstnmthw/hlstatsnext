import { createYoga } from "graphql-yoga"
import { createServer } from "node:http"
import { schema } from "./pothos-schema"
// import { createContext } from "./context"

// Create GraphQL Yoga server
const yoga = createYoga({
  landingPage: false,
  schema,
  // context: createContext,
  cors: {
    origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "http://localhost:3000",
    credentials: true,
  },
  // GraphQL endpoint
  graphqlEndpoint: "/graphql",
  // Enable GraphiQL in development
  graphiql: process.env.NODE_ENV !== "production",
})

// Create HTTP server
const server = createServer(yoga)

const port = process.env.PORT || 4000

server.listen(port, () => {
  console.log(`🚀 GraphQL API server ready at http://localhost:${port}/graphql`)
  if (process.env.NODE_ENV !== "production") {
    console.log(`📊 GraphiQL interface available at http://localhost:${port}/graphql`)
  }
})
