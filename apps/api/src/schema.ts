export const typeDefs = /* GraphQL */ `
  type Query {
    hello: String!
    health: HealthStatus!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    version: String!
  }

  # Mutations will be added during Phase 1.4: GraphQL API Foundation
  # This includes:
  # - Player queries and mutations
  # - Server status queries
  # - Game statistics queries
  # - Real-time subscriptions

  # Subscription support will be implemented for real-time updates
  # type Subscription {
  #   serverStatus: ServerStatus
  #   playerUpdate: Player
  # }
`;
