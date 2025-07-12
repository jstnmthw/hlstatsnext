/**
 * Database package entry point
 */

// Export database client and Prisma types
export * from "./client"
export * from "./builder"

// Export GraphQL-related types
export * as GraphQL from "./generated/graphql/pothos-crud"
export * as GraphQLInputs from "./generated/graphql/pothos-inputs"
export * as GraphQLTypes from "./generated/graphql/pothos-types"

// Alternative: More explicit export if you need better type safety
// import * as PothosCrud from "./generated/graphql/pothos-crud"
// export { PothosCrud as GraphQL }
