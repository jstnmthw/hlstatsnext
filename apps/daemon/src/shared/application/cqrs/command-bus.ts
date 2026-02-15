/**
 * Command Bus Implementation
 *
 * Dispatches commands to their registered handlers with validation and error handling.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { ICommand, ICommandBus, ICommandHandler } from "./command.types"

/**
 * Command Bus
 *
 * Central dispatcher for write operations (commands).
 */
export class CommandBus implements ICommandBus {
  private readonly handlers = new Map<string, ICommandHandler<ICommand, unknown>>()

  constructor(private readonly logger: ILogger) {}

  /**
   * Execute a command through its registered handler
   */
  async execute(command: ICommand): Promise<unknown> {
    const startTime = Date.now()
    const commandType = command.constructor.name

    try {
      this.logger.debug(`Executing command: ${commandType}`, {
        commandId: command.commandId,
        commandType,
        timestamp: command.timestamp,
      })

      // Find handler for this command type
      const handler = this.handlers.get(commandType)
      if (!handler) {
        throw new Error(`No handler registered for command type: ${commandType}`)
      }

      // Validate command if handler supports validation
      if (handler.validate) {
        const isValid = await handler.validate(command)
        if (!isValid) {
          throw new Error(`Command validation failed for: ${commandType}`)
        }
      }

      // Execute the command
      const result = await handler.handle(command)
      const executionTime = Date.now() - startTime

      this.logger.debug(`Command executed successfully: ${commandType}`, {
        commandId: command.commandId,
        commandType,
        executionTime,
      })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Command execution failed: ${commandType}`, {
        commandId: command.commandId,
        commandType,
        executionTime,
        error: errorMessage,
      })

      throw new Error(`Command execution failed: ${errorMessage}`)
    }
  }

  /**
   * Register a command handler
   */
  register<TCommand extends ICommand, TResult = void>(
    handler: ICommandHandler<TCommand, TResult>,
  ): void {
    const commandType = handler.getCommandType()

    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command type: ${commandType}`)
    }

    this.handlers.set(commandType, handler)

    this.logger.debug(`Registered command handler: ${commandType}`, {
      commandType,
      handlerName: handler.constructor.name,
    })
  }

  /**
   * Unregister a command handler
   */
  unregister(commandType: string): void {
    if (this.handlers.delete(commandType)) {
      this.logger.debug(`Unregistered command handler: ${commandType}`)
    }
  }

  /**
   * Get all registered command types
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if a command type has a registered handler
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType)
  }

  /**
   * Get command bus statistics
   */
  getStats(): {
    registeredHandlers: number
    handlerTypes: string[]
  } {
    return {
      registeredHandlers: this.handlers.size,
      handlerTypes: Array.from(this.handlers.keys()),
    }
  }
}
