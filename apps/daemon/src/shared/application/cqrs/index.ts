/**
 * CQRS (Command Query Responsibility Segregation) Exports
 *
 * Central export point for all CQRS components.
 */

// Types and interfaces
export * from "./command.types"

// Bus implementations
export { CommandBus } from "./command-bus"
export { QueryBus } from "./query-bus"
export {
  CachedQueryBus,
  createCachedQuery,
  CacheKeyPatterns,
  type CachedQuery,
  type CacheOptions,
} from "./cached-query-bus"

// Re-export for convenience
export type {
  ICommand,
  IQuery,
  ICommandHandler,
  IQueryHandler,
  ICommandBus,
  IQueryBus,
  CommandResult,
  QueryResult,
} from "./command.types"
