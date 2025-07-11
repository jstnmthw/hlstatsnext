/**
 * Database package entry point
 */

// Export database client and Prisma types
export * from "./client"

// Export GraphQL-related types under namespace to avoid conflicts
export * as GraphQL from "./generated/graphql/pothos-crud"
export * as GraphQLInputs from "./generated/graphql/pothos-inputs"
export * as GraphQLTypes from "./generated/graphql/pothos-types"
