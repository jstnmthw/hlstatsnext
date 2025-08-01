/**
 * Base Saga Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { BaseSaga } from "./saga.base"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { ISagaMonitor, SagaStep, SagaContext } from "./saga.types"
import { EventType } from "@/shared/types/events"

// Test saga implementation
class TestSaga extends BaseSaga {
  readonly name = "TestSaga"
  
  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    monitor?: ISagaMonitor,
  ) {
    super(logger, eventBus, monitor)
    this.initializeSteps()
  }

  protected initializeSteps(): void {
    // Steps will be added in tests
  }

  addStep(step: SagaStep): void {
    this.steps.push(step)
  }

  clearSteps(): void {
    this.steps = []
  }
}

// Test step implementations
class SuccessfulStep implements SagaStep {
  readonly name = "SuccessfulStep"
  execute = vi.fn().mockResolvedValue(undefined)
  compensate = vi.fn().mockResolvedValue(undefined)
}

class FailingStep implements SagaStep {
  readonly name = "FailingStep"
  execute = vi.fn().mockRejectedValue(new Error("Step failed"))
  compensate = vi.fn().mockResolvedValue(undefined)
}

class DataMutatingStep implements SagaStep {
  readonly name = "DataMutatingStep"
  
  constructor(private dataKey: string, private dataValue: unknown) {}
  
  async execute(context: SagaContext): Promise<void> {
    context.data[this.dataKey] = this.dataValue
  }
  
  async compensate(context: SagaContext): Promise<void> {
    delete context.data[this.dataKey]
  }
}

describe("BaseSaga", () => {
  let saga: TestSaga
  let logger: ILogger
  let eventBus: IEventBus
  let monitor: ISagaMonitor

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    eventBus = {
      emit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as IEventBus

    monitor = {
      onSagaStarted: vi.fn(),
      onStepExecuted: vi.fn(),
      onStepCompensated: vi.fn(),
      onSagaCompleted: vi.fn(),
      onSagaFailed: vi.fn(),
    }

    saga = new TestSaga(logger, eventBus, monitor)
  })

  describe("Successful Execution", () => {
    it("should execute all steps successfully", async () => {
      const step1 = new SuccessfulStep()
      const step2 = new SuccessfulStep()
      const step3 = new SuccessfulStep()

      saga.addStep(step1)
      saga.addStep(step2)
      saga.addStep(step3)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await saga.execute(event)

      // Verify all steps were executed
      expect(step1.execute).toHaveBeenCalledTimes(1)
      expect(step2.execute).toHaveBeenCalledTimes(1)
      expect(step3.execute).toHaveBeenCalledTimes(1)

      // Verify no compensations were called
      expect(step1.compensate).not.toHaveBeenCalled()
      expect(step2.compensate).not.toHaveBeenCalled()
      expect(step3.compensate).not.toHaveBeenCalled()

      // Verify monitoring
      expect(monitor.onSagaStarted).toHaveBeenCalledWith(
        "TestSaga",
        expect.any(String),
        expect.any(String)
      )
      expect(monitor.onStepExecuted).toHaveBeenCalledTimes(3)
      expect(monitor.onSagaCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          sagaName: "TestSaga",
          success: true,
          completedSteps: 3,
          totalSteps: 3,
        })
      )
    })

    it("should pass context between steps", async () => {
      const step1 = new DataMutatingStep("value1", "test1")
      const step2 = new DataMutatingStep("value2", "test2")
      const step3 = vi.fn().mockImplementation(async (context: SagaContext) => {
        expect(context.data.value1).toBe("test1")
        expect(context.data.value2).toBe("test2")
      })

      saga.addStep(step1)
      saga.addStep(step2)
      saga.addStep({ 
        name: "VerifyStep", 
        execute: step3, 
        compensate: vi.fn() 
      })

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { initialData: true },
      }

      await saga.execute(event)

      expect(step3).toHaveBeenCalled()
    })

    it("should generate event and correlation IDs", async () => {
      const step = vi.fn().mockImplementation(async (context: SagaContext) => {
        expect(context.eventId).toBeDefined()
        expect(context.correlationId).toBeDefined()
        expect(context.eventId).toMatch(/^\d+-[a-z0-9]+$/)
        expect(context.correlationId).toMatch(/^\d+-[a-z0-9]+$/)
      })

      saga.addStep({ 
        name: "CheckIdsStep", 
        execute: step, 
        compensate: vi.fn() 
      })

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await saga.execute(event)

      expect(step).toHaveBeenCalled()
    })

    it("should use provided event and correlation IDs", async () => {
      const providedEventId = "custom-event-123"
      const providedCorrelationId = "custom-correlation-456"

      const step = vi.fn().mockImplementation(async (context: SagaContext) => {
        expect(context.eventId).toBe(providedEventId)
        expect(context.correlationId).toBe(providedCorrelationId)
      })

      saga.addStep({ 
        name: "CheckProvidedIdsStep", 
        execute: step, 
        compensate: vi.fn() 
      })

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: providedEventId,
        correlationId: providedCorrelationId,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await saga.execute(event)

      expect(step).toHaveBeenCalled()
    })
  })

  describe("Failure and Compensation", () => {
    it("should run compensations in reverse order on failure", async () => {
      const step1 = new SuccessfulStep()
      const step2 = new SuccessfulStep()
      const step3 = new FailingStep()
      const step4 = new SuccessfulStep()

      saga.addStep(step1)
      saga.addStep(step2)
      saga.addStep(step3)
      saga.addStep(step4)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(saga.execute(event)).rejects.toThrow("Step failed")

      // Verify steps 1 and 2 were executed
      expect(step1.execute).toHaveBeenCalledTimes(1)
      expect(step2.execute).toHaveBeenCalledTimes(1)
      expect(step3.execute).toHaveBeenCalledTimes(1)
      expect(step4.execute).not.toHaveBeenCalled()

      // Verify compensations were called in reverse order
      expect(step2.compensate).toHaveBeenCalledTimes(1)
      expect(step1.compensate).toHaveBeenCalledTimes(1)
      
      // Step 3 and 4 should not be compensated (3 failed, 4 wasn't executed)
      expect(step3.compensate).not.toHaveBeenCalled()
      expect(step4.compensate).not.toHaveBeenCalled()

      // Verify monitoring
      expect(monitor.onStepCompensated).toHaveBeenCalledTimes(2)
      expect(monitor.onSagaFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          sagaName: "TestSaga",
          success: false,
          completedSteps: 2,
          totalSteps: 4,
          compensatedSteps: 2,
        })
      )
    })

    it("should continue compensations even if one fails", async () => {
      const step1 = new SuccessfulStep()
      const step2 = {
        name: "FailingCompensationStep",
        execute: vi.fn().mockResolvedValue(undefined),
        compensate: vi.fn().mockRejectedValue(new Error("Compensation failed")),
      }
      const step3 = new SuccessfulStep()
      const failingExecutionStep = new FailingStep()

      saga.addStep(step1)
      saga.addStep(step2)
      saga.addStep(step3)
      saga.addStep(failingExecutionStep)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(saga.execute(event)).rejects.toThrow("Step failed")

      // All compensations should be attempted
      expect(step3.compensate).toHaveBeenCalledTimes(1)
      expect(step2.compensate).toHaveBeenCalledTimes(1)
      expect(step1.compensate).toHaveBeenCalledTimes(1)

      // Error should be logged for failed compensation
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Compensation failed for step FailingCompensationStep"),
        expect.any(Object)
      )
    })

    it("should maintain context during compensations", async () => {
      const compensationOrder: string[] = []
      
      const step1 = {
        name: "Step1",
        execute: vi.fn().mockImplementation(async (context: SagaContext) => {
          context.data.step1Executed = true
        }),
        compensate: vi.fn().mockImplementation(async (context: SagaContext) => {
          expect(context.data.step1Executed).toBe(true)
          expect(context.data.step2Executed).toBe(true)
          compensationOrder.push("step1")
        }),
      }

      const step2 = {
        name: "Step2",
        execute: vi.fn().mockImplementation(async (context: SagaContext) => {
          context.data.step2Executed = true
        }),
        compensate: vi.fn().mockImplementation(async (context: SagaContext) => {
          expect(context.data.step1Executed).toBe(true)
          expect(context.data.step2Executed).toBe(true)
          compensationOrder.push("step2")
        }),
      }

      saga.addStep(step1)
      saga.addStep(step2)
      saga.addStep(new FailingStep())

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(saga.execute(event)).rejects.toThrow("Step failed")

      expect(compensationOrder).toEqual(["step2", "step1"])
    })
  })

  describe("Without Monitor", () => {
    it("should work without a monitor", async () => {
      const sagaWithoutMonitor = new TestSaga(logger, eventBus)
      const step = new SuccessfulStep()
      sagaWithoutMonitor.addStep(step)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(sagaWithoutMonitor.execute(event)).resolves.toBeUndefined()
      expect(step.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty steps array", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(saga.execute(event)).resolves.toBeUndefined()

      expect(monitor.onSagaCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          completedSteps: 0,
          totalSteps: 0,
        })
      )
    })

    it("should handle steps without names", async () => {
      const anonymousStep = {
        execute: vi.fn().mockResolvedValue(undefined),
        compensate: vi.fn().mockResolvedValue(undefined),
      }

      saga.addStep(anonymousStep)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await saga.execute(event)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Executing saga step:"),
        expect.any(Object)
      )
    })

    it("should preserve original event data", async () => {
      const originalData = { important: "value", nested: { data: true } }
      
      const step = vi.fn().mockImplementation(async (context: SagaContext) => {
        // Verify original event is preserved
        expect(context.originalEvent.data).toEqual(originalData)
        
        // Modifying context data should not affect original
        context.data.modified = true
      })

      saga.addStep({ 
        name: "PreserveDataStep", 
        execute: step, 
        compensate: vi.fn() 
      })

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: originalData,
      }

      await saga.execute(event)

      // Original event should remain unchanged
      expect(event.data).toEqual(originalData)
      expect(event.data).not.toHaveProperty("modified")
    })

    it("should handle non-Error exceptions", async () => {
      const stringError = "String error"
      const step = {
        name: "StringErrorStep",
        execute: vi.fn().mockRejectedValue(stringError),
        compensate: vi.fn(),
      }

      saga.addStep(step)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(saga.execute(event)).rejects.toThrow(stringError)

      expect(monitor.onSagaFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        })
      )
    })
  })
})