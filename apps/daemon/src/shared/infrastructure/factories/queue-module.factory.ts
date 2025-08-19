/**
 * Queue Module Factory
 * 
 * Handles the creation and configuration of queue infrastructure
 * with proper error handling and fallback behavior.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { QueueModule, createDevelopmentRabbitMQConfig } from "@/shared/infrastructure/messaging/module"

export interface QueueModuleResult {
  queueModule?: QueueModule
  success: boolean
  error?: string
}

/**
 * Creates queue module with development configuration and error handling
 * 
 * @param logger - Logger instance for status reporting
 * @returns Result object with queue module or error information
 */
export function createQueueModule(logger: ILogger): QueueModuleResult {
  try {
    const rabbitmqConfig = createDevelopmentRabbitMQConfig(process.env.RABBITMQ_URL)
    const queueModule = new QueueModule(
      {
        rabbitmq: rabbitmqConfig,
        autoStartConsumers: false,
        autoSetupTopology: true,
      },
      logger,
    )

    logger.info("Queue module created - will initialize during ingress service creation")

    return {
      queueModule,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.warn(`Failed to create queue module: ${errorMessage}`)
    logger.warn("Continuing with EventBus only")

    return {
      success: false,
      error: errorMessage,
    }
  }
}