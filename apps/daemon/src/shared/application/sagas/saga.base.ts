/**
 * Base Saga Implementation
 *
 * Provides the core saga execution logic with step orchestration,
 * compensation handling, and monitoring integration.
 */

import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ISaga, SagaStep, SagaContext, SagaExecutionResult, ISagaMonitor } from "./saga.types"

/**
 * Generates a unique identifier for saga execution tracking
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export abstract class BaseSaga implements ISaga {
  protected steps: SagaStep[] = []

  constructor(
    protected readonly logger: ILogger,
    protected readonly eventBus: IEventBus,
    protected readonly monitor?: ISagaMonitor,
  ) {}

  abstract readonly name: string

  /**
   * Initialize the saga steps. Called by concrete implementations.
   */
  protected abstract initializeSteps(): void

  async execute(event: BaseEvent): Promise<void> {
    const startTime = Date.now()
    const eventId = event.eventId || generateId()
    const correlationId = event.correlationId || generateId()

    const context: SagaContext = {
      eventId,
      correlationId,
      originalEvent: { ...event, eventId, correlationId },
      data: {},
    }

    this.monitor?.onSagaStarted(this.name, eventId, correlationId)
    this.logger.info(`Starting saga ${this.name} for event ${event.eventType}`, {
      eventId,
      correlationId,
    })

    const completedSteps: SagaStep[] = []

    try {
      // Execute all steps sequentially
      for (const step of this.steps) {
        const stepName = step.name || step.constructor.name
        this.logger.debug(`Executing saga step: ${stepName}`, { eventId, correlationId })

        await step.execute(context)
        completedSteps.push(step)

        this.monitor?.onStepExecuted(this.name, stepName, eventId)
        this.logger.debug(`Completed saga step: ${stepName}`, { eventId, correlationId })
      }

      const result: SagaExecutionResult = {
        sagaName: this.name,
        eventId,
        correlationId,
        success: true,
        completedSteps: completedSteps.length,
        totalSteps: this.steps.length,
        executionTimeMs: Date.now() - startTime,
      }

      this.monitor?.onSagaCompleted(result)
      this.logger.info(`Saga ${this.name} completed successfully`, {
        eventId,
        correlationId,
        executionTimeMs: result.executionTimeMs,
      })
    } catch (error) {
      this.logger.error(`Saga ${this.name} failed, running compensations`, {
        eventId,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      })

      const compensatedSteps = await this.runCompensations(completedSteps, context)

      const result: SagaExecutionResult = {
        sagaName: this.name,
        eventId,
        correlationId,
        success: false,
        completedSteps: completedSteps.length,
        totalSteps: this.steps.length,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        compensatedSteps,
      }

      this.monitor?.onSagaFailed(result)
      throw error
    }
  }

  /**
   * Run compensations for completed steps in reverse order
   */
  private async runCompensations(
    completedSteps: SagaStep[],
    context: SagaContext,
  ): Promise<number> {
    let compensatedCount = 0

    // Run compensations in reverse order
    for (const step of completedSteps.reverse()) {
      try {
        const stepName = step.name || step.constructor.name
        this.logger.debug(`Compensating saga step: ${stepName}`, {
          eventId: context.eventId,
          correlationId: context.correlationId,
        })

        await step.compensate(context)
        compensatedCount++

        this.monitor?.onStepCompensated(this.name, stepName, context.eventId)
        this.logger.debug(`Compensated saga step: ${stepName}`, {
          eventId: context.eventId,
          correlationId: context.correlationId,
        })
      } catch (compensationError) {
        this.logger.error(`Compensation failed for step ${step.name || step.constructor.name}`, {
          eventId: context.eventId,
          correlationId: context.correlationId,
          error:
            compensationError instanceof Error
              ? compensationError.message
              : String(compensationError),
        })
        // Continue with other compensations even if one fails
      }
    }

    return compensatedCount
  }
}
