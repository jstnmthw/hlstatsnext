/**
 * Saga Types and Interfaces
 * 
 * Defines the core interfaces for implementing saga patterns in the distributed
 * event architecture. Sagas provide transactional consistency across modules
 * and handle compensating actions for failed operations.
 */

import type { BaseEvent } from "@/shared/types/events"

/**
 * Context passed to each saga step containing event data and accumulated state
 */
export interface SagaContext {
  readonly eventId: string
  readonly correlationId: string
  readonly originalEvent: BaseEvent
  data: Record<string, unknown>
}

/**
 * A single step in a saga that can be executed and compensated
 */
export interface SagaStep {
  /**
   * Execute the step's business logic
   * @param context - The saga context containing event data and state
   */
  execute(context: SagaContext): Promise<void>

  /**
   * Compensate for this step if a later step fails
   * @param context - The saga context containing event data and state
   */
  compensate(context: SagaContext): Promise<void>

  /**
   * Optional step name for logging and debugging
   */
  readonly name?: string
}

/**
 * Main saga interface for orchestrating multi-step transactions
 */
export interface ISaga {
  /**
   * Execute the entire saga for the given event
   * @param event - The event that triggered this saga
   */
  execute(event: BaseEvent): Promise<void>

  /**
   * Get the name of this saga for logging
   */
  readonly name: string
}

/**
 * Saga execution result for monitoring and debugging
 */
export interface SagaExecutionResult {
  readonly sagaName: string
  readonly eventId: string
  readonly correlationId: string
  readonly success: boolean
  readonly completedSteps: number
  readonly totalSteps: number
  readonly executionTimeMs: number
  readonly error?: Error
  readonly compensatedSteps?: number
}

/**
 * Interface for saga execution monitoring
 */
export interface ISagaMonitor {
  onSagaStarted(sagaName: string, eventId: string, correlationId: string): void
  onStepExecuted(sagaName: string, stepName: string, eventId: string): void
  onStepCompensated(sagaName: string, stepName: string, eventId: string): void
  onSagaCompleted(result: SagaExecutionResult): void
  onSagaFailed(result: SagaExecutionResult): void
}