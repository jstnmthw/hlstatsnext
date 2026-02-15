/**
 * CQRS (Command Query Responsibility Segregation) Exports
 *
 * Central export point for all CQRS components.
 */

// Types and interfaces
export * from "./command.types"

// Bus implementations
export {
  CacheKeyPatterns,
  CachedQueryBus,
  createCachedQuery,
  type CacheOptions,
  type CachedQuery,
} from "./cached-query-bus"
export { CommandBus } from "./command-bus"
export { QueryBus } from "./query-bus"

// Re-export for convenience
export type {
  CommandResult,
  ICommand,
  ICommandBus,
  ICommandHandler,
  IQuery,
  IQueryBus,
  IQueryHandler,
  QueryResult,
} from "./command.types"
