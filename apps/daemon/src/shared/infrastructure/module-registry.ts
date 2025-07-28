/**
 * Module Registry
 * 
 * Centralized registry for managing module event handlers,
 * providing discovery and lifecycle management capabilities.
 */

import type { BaseModuleEventHandler } from "./module-event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import { EventType } from "@/shared/types/events"

export interface ModuleEventHandler {
  name: string
  handler: BaseModuleEventHandler
  handledEvents: EventType[]
}

export class ModuleRegistry {
  private modules: Map<string, ModuleEventHandler> = new Map()

  constructor(private readonly logger: ILogger) {}

  /**
   * Register a module event handler
   */
  register(module: ModuleEventHandler): void {
    if (this.modules.has(module.name)) {
      this.logger.warn(`Module ${module.name} is already registered, replacing`)
    }

    this.modules.set(module.name, module)
    this.logger.info(`Registered module handler: ${module.name}`, {
      handledEvents: module.handledEvents,
    })
  }

  /**
   * Unregister a module event handler
   */
  unregister(moduleName: string): void {
    const module = this.modules.get(moduleName)
    if (!module) {
      this.logger.warn(`Attempted to unregister unknown module: ${moduleName}`)
      return
    }

    module.handler.destroy()
    this.modules.delete(moduleName)
    this.logger.info(`Unregistered module handler: ${moduleName}`)
  }

  /**
   * Get handlers for a specific event type
   */
  getHandlersForEvent(eventType: EventType): ModuleEventHandler[] {
    return Array.from(this.modules.values())
      .filter(module => module.handledEvents.includes(eventType))
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleEventHandler[] {
    return Array.from(this.modules.values())
  }

  /**
   * Get a specific module by name
   */
  getModule(name: string): ModuleEventHandler | undefined {
    return this.modules.get(name)
  }

  /**
   * Check if a module is registered
   */
  hasModule(name: string): boolean {
    return this.modules.has(name)
  }

  /**
   * Initialize all registered modules
   * This is called during application startup
   */
  async initializeAll(): Promise<void> {
    this.logger.info(`Initializing ${this.modules.size} module handlers`)

    for (const [name] of this.modules.entries()) {
      try {
        // Module handlers are already initialized in their constructors
        // This is a placeholder for any additional initialization logic
        this.logger.debug(`Module ${name} initialized`)
      } catch (error) {
        this.logger.error(`Failed to initialize module ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }

    this.logger.info("All module handlers initialized successfully")
  }

  /**
   * Destroy all registered modules
   * This is called during application shutdown
   */
  async destroyAll(): Promise<void> {
    this.logger.info(`Destroying ${this.modules.size} module handlers`)

    for (const [name, module] of this.modules.entries()) {
      try {
        module.handler.destroy()
        this.logger.debug(`Module ${name} destroyed`)
      } catch (error) {
        this.logger.error(`Failed to destroy module ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        })
        // Continue destroying other modules even if one fails
      }
    }

    this.modules.clear()
    this.logger.info("All module handlers destroyed")
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const eventCoverage = new Map<EventType, string[]>()
    
    for (const [name, module] of this.modules.entries()) {
      for (const eventType of module.handledEvents) {
        if (!eventCoverage.has(eventType)) {
          eventCoverage.set(eventType, [])
        }
        eventCoverage.get(eventType)!.push(name)
      }
    }

    return {
      totalModules: this.modules.size,
      moduleNames: Array.from(this.modules.keys()),
      eventCoverage: Object.fromEntries(eventCoverage.entries()),
      duplicateHandlers: Array.from(eventCoverage.entries())
        .filter(([, handlers]) => handlers.length > 1)
        .map(([eventType, handlers]) => ({ eventType, handlers })),
    }
  }
}