/**
 * Command/Query Responsibility Segregation (CQRS) Types
 *
 * Separates commands (write operations) from queries (read operations)
 * for better maintainability and performance optimization.
 */

/**
 * Base command interface for write operations
 */
export interface ICommand {
  readonly commandId: string
  readonly timestamp: Date
}

/**
 * Base query interface for read operations
 */
export interface IQuery {
  readonly queryId: string
  readonly timestamp: Date
}

/**
 * Command handler interface
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  /**
   * Handle the command and return result
   */
  handle(command: TCommand): Promise<TResult>

  /**
   * Get the command type this handler supports
   */
  getCommandType(): string

  /**
   * Validate command before execution
   */
  validate?(command: TCommand): Promise<boolean>
}

/**
 * Query handler interface
 */
export interface IQueryHandler<TQuery extends IQuery, TResult> {
  /**
   * Handle the query and return result
   */
  handle(query: TQuery): Promise<TResult>

  /**
   * Get the query type this handler supports
   */
  getQueryType(): string

  /**
   * Validate query before execution
   */
  validate?(query: TQuery): Promise<boolean>
}

/**
 * Command bus interface for dispatching commands
 */
export interface ICommandBus {
  /**
   * Execute a command
   */
  execute(command: ICommand): Promise<unknown>

  /**
   * Register a command handler
   */
  register<TCommand extends ICommand, TResult = void>(
    handler: ICommandHandler<TCommand, TResult>,
  ): void
}

/**
 * Query bus interface for dispatching queries
 */
export interface IQueryBus {
  /**
   * Execute a query
   */
  execute<TResult>(query: IQuery): Promise<TResult>

  /**
   * Register a query handler
   */
  register<TQuery extends IQuery, TResult>(handler: IQueryHandler<TQuery, TResult>): void
}

/**
 * Command execution result
 */
export interface CommandResult<TData = unknown> {
  success: boolean
  data?: TData
  error?: string
  commandId: string
  executionTime: number
}

/**
 * Query execution result
 */
export interface QueryResult<TData = unknown> {
  success: boolean
  data?: TData
  error?: string
  queryId: string
  executionTime: number
  cached?: boolean
}

/**
 * Base abstract command class
 */
export abstract class BaseCommand implements ICommand {
  public readonly commandId: string
  public readonly timestamp: Date

  constructor(commandId?: string) {
    this.commandId = commandId || `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.timestamp = new Date()
  }
}

/**
 * Base abstract query class
 */
export abstract class BaseQuery implements IQuery {
  public readonly queryId: string
  public readonly timestamp: Date

  constructor(queryId?: string) {
    this.queryId = queryId || `qry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.timestamp = new Date()
  }
}
