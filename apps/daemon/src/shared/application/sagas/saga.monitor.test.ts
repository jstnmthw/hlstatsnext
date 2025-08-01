/**
 * Saga Monitor Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { SagaMonitor } from "./saga.monitor"
import type { ILogger } from "@/shared/utils/logger.types"
import type { SagaExecutionResult } from "./saga.types"

describe("SagaMonitor", () => {
  let monitor: SagaMonitor
  let logger: ILogger

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    monitor = new SagaMonitor(logger)
  })

  describe("Event Tracking", () => {
    it("should log saga start events", () => {
      const sagaName = "TestSaga"
      const eventId = "event-123"
      const correlationId = "correlation-456"

      monitor.onSagaStarted(sagaName, eventId, correlationId)

      expect(logger.debug).toHaveBeenCalledWith(`Saga started: ${sagaName}`, {
        sagaName,
        eventId,
        correlationId,
      })
    })

    it("should log step execution events", () => {
      const sagaName = "TestSaga"
      const stepName = "ProcessStep"
      const eventId = "event-123"

      monitor.onStepExecuted(sagaName, stepName, eventId)

      expect(logger.debug).toHaveBeenCalledWith(`Saga step executed: ${sagaName}.${stepName}`, {
        sagaName,
        stepName,
        eventId,
      })
    })

    it("should log step compensation events with warning level", () => {
      const sagaName = "TestSaga"
      const stepName = "ProcessStep"
      const eventId = "event-123"

      monitor.onStepCompensated(sagaName, stepName, eventId)

      expect(logger.warn).toHaveBeenCalledWith(`Saga step compensated: ${sagaName}.${stepName}`, {
        sagaName,
        stepName,
        eventId,
      })
    })
  })

  describe("Successful Saga Completion", () => {
    it("should track successful saga execution metrics", () => {
      const result: SagaExecutionResult = {
        sagaName: "TestSaga",
        eventId: "event-123",
        correlationId: "correlation-456",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 150,
      }

      monitor.onSagaCompleted(result)

      const metrics = monitor.getMetrics("TestSaga")
      expect(metrics).toEqual({
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
        totalExecutionTime: 150,
        averageExecutionTime: 150,
      })
    })

    it("should accumulate metrics for multiple successful executions", () => {
      const saga1: SagaExecutionResult = {
        sagaName: "TestSaga",
        eventId: "event-1",
        correlationId: "correlation-1",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 100,
      }

      const saga2: SagaExecutionResult = {
        sagaName: "TestSaga",
        eventId: "event-2",
        correlationId: "correlation-2",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 200,
      }

      const saga3: SagaExecutionResult = {
        sagaName: "TestSaga",
        eventId: "event-3",
        correlationId: "correlation-3",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 300,
      }

      monitor.onSagaCompleted(saga1)
      monitor.onSagaCompleted(saga2)
      monitor.onSagaCompleted(saga3)

      const metrics = monitor.getMetrics("TestSaga")
      expect(metrics).toEqual({
        totalExecutions: 3,
        successfulExecutions: 3,
        failedExecutions: 0,
        totalExecutionTime: 600,
        averageExecutionTime: 200,
      })
    })
  })

  describe("Failed Saga Completion", () => {
    it("should track failed saga execution metrics", () => {
      const result: SagaExecutionResult = {
        sagaName: "TestSaga",
        eventId: "event-123",
        correlationId: "correlation-456",
        success: false,
        completedSteps: 2,
        totalSteps: 4,
        executionTimeMs: 75,
        error: new Error("Step 3 failed"),
        compensatedSteps: 2,
      }

      monitor.onSagaFailed(result)

      expect(logger.error).toHaveBeenCalledWith(`Saga failed: ${result.sagaName}`, {
        sagaName: "TestSaga",
        eventId: "event-123",
        correlationId: "correlation-456",
        executionTimeMs: 75,
        completedSteps: 2,
        totalSteps: 4,
        compensatedSteps: 2,
        error: "Step 3 failed",
      })

      const metrics = monitor.getMetrics("TestSaga")
      expect(metrics).toEqual({
        totalExecutions: 1,
        successfulExecutions: 0,
        failedExecutions: 1,
        totalExecutionTime: 75,
        averageExecutionTime: 75,
      })
    })

    it("should handle mixed success and failure metrics", () => {
      const success1: SagaExecutionResult = {
        sagaName: "MixedSaga",
        eventId: "event-1",
        correlationId: "correlation-1",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 100,
      }

      const failure: SagaExecutionResult = {
        sagaName: "MixedSaga",
        eventId: "event-2",
        correlationId: "correlation-2",
        success: false,
        completedSteps: 1,
        totalSteps: 3,
        executionTimeMs: 50,
        error: new Error("Failed"),
        compensatedSteps: 1,
      }

      const success2: SagaExecutionResult = {
        sagaName: "MixedSaga",
        eventId: "event-3",
        correlationId: "correlation-3",
        success: true,
        completedSteps: 3,
        totalSteps: 3,
        executionTimeMs: 150,
      }

      monitor.onSagaCompleted(success1)
      monitor.onSagaFailed(failure)
      monitor.onSagaCompleted(success2)

      const metrics = monitor.getMetrics("MixedSaga")
      expect(metrics).toEqual({
        totalExecutions: 3,
        successfulExecutions: 2,
        failedExecutions: 1,
        totalExecutionTime: 300,
        averageExecutionTime: 100,
      })
    })
  })

  describe("Multiple Saga Tracking", () => {
    it("should track metrics for multiple different sagas", () => {
      const saga1Result: SagaExecutionResult = {
        sagaName: "SagaOne",
        eventId: "event-1",
        correlationId: "correlation-1",
        success: true,
        completedSteps: 2,
        totalSteps: 2,
        executionTimeMs: 100,
      }

      const saga2Result: SagaExecutionResult = {
        sagaName: "SagaTwo",
        eventId: "event-2",
        correlationId: "correlation-2",
        success: false,
        completedSteps: 1,
        totalSteps: 3,
        executionTimeMs: 50,
        error: new Error("Failed"),
      }

      monitor.onSagaCompleted(saga1Result)
      monitor.onSagaFailed(saga2Result)

      const saga1Metrics = monitor.getMetrics("SagaOne")
      expect(saga1Metrics).toEqual({
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
        totalExecutionTime: 100,
        averageExecutionTime: 100,
      })

      const saga2Metrics = monitor.getMetrics("SagaTwo")
      expect(saga2Metrics).toEqual({
        totalExecutions: 1,
        successfulExecutions: 0,
        failedExecutions: 1,
        totalExecutionTime: 50,
        averageExecutionTime: 50,
      })
    })

    it("should return all metrics", () => {
      const results: SagaExecutionResult[] = [
        {
          sagaName: "SagaA",
          eventId: "event-1",
          correlationId: "correlation-1",
          success: true,
          completedSteps: 2,
          totalSteps: 2,
          executionTimeMs: 100,
        },
        {
          sagaName: "SagaB",
          eventId: "event-2",
          correlationId: "correlation-2",
          success: true,
          completedSteps: 3,
          totalSteps: 3,
          executionTimeMs: 200,
        },
        {
          sagaName: "SagaC",
          eventId: "event-3",
          correlationId: "correlation-3",
          success: false,
          completedSteps: 1,
          totalSteps: 4,
          executionTimeMs: 50,
          error: new Error("Failed"),
        },
      ]

      results.forEach((result) => {
        if (result.success) {
          monitor.onSagaCompleted(result)
        } else {
          monitor.onSagaFailed(result)
        }
      })

      const allMetrics = monitor.getAllMetrics()
      expect(allMetrics).toEqual({
        SagaA: {
          totalExecutions: 1,
          successfulExecutions: 1,
          failedExecutions: 0,
          totalExecutionTime: 100,
          averageExecutionTime: 100,
        },
        SagaB: {
          totalExecutions: 1,
          successfulExecutions: 1,
          failedExecutions: 0,
          totalExecutionTime: 200,
          averageExecutionTime: 200,
        },
        SagaC: {
          totalExecutions: 1,
          successfulExecutions: 0,
          failedExecutions: 1,
          totalExecutionTime: 50,
          averageExecutionTime: 50,
        },
      })
    })
  })

  describe("Metrics Management", () => {
    it("should return undefined for non-existent saga metrics", () => {
      const metrics = monitor.getMetrics("NonExistentSaga")
      expect(metrics).toBeUndefined()
    })

    it("should reset all metrics", () => {
      const results: SagaExecutionResult[] = [
        {
          sagaName: "SagaToReset1",
          eventId: "event-1",
          correlationId: "correlation-1",
          success: true,
          completedSteps: 2,
          totalSteps: 2,
          executionTimeMs: 100,
        },
        {
          sagaName: "SagaToReset2",
          eventId: "event-2",
          correlationId: "correlation-2",
          success: true,
          completedSteps: 3,
          totalSteps: 3,
          executionTimeMs: 200,
        },
      ]

      results.forEach((result) => monitor.onSagaCompleted(result))

      // Verify metrics exist
      expect(monitor.getMetrics("SagaToReset1")).toBeDefined()
      expect(monitor.getMetrics("SagaToReset2")).toBeDefined()

      // Reset metrics
      monitor.resetMetrics()

      // Verify metrics are cleared
      expect(monitor.getMetrics("SagaToReset1")).toBeUndefined()
      expect(monitor.getMetrics("SagaToReset2")).toBeUndefined()
      expect(monitor.getAllMetrics()).toEqual({})
    })

    it("should handle zero execution time", () => {
      const result: SagaExecutionResult = {
        sagaName: "FastSaga",
        eventId: "event-1",
        correlationId: "correlation-1",
        success: true,
        completedSteps: 1,
        totalSteps: 1,
        executionTimeMs: 0,
      }

      monitor.onSagaCompleted(result)

      const metrics = monitor.getMetrics("FastSaga")
      expect(metrics).toEqual({
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
      })
    })

    it("should calculate accurate average execution times", () => {
      const executions = [
        { time: 100, success: true },
        { time: 200, success: true },
        { time: 50, success: false },
        { time: 150, success: true },
        { time: 300, success: false },
      ]

      executions.forEach((exec, index) => {
        const result: SagaExecutionResult = {
          sagaName: "AverageSaga",
          eventId: `event-${index}`,
          correlationId: `correlation-${index}`,
          success: exec.success,
          completedSteps: exec.success ? 3 : 1,
          totalSteps: 3,
          executionTimeMs: exec.time,
          error: exec.success ? undefined : new Error("Failed"),
        }

        if (exec.success) {
          monitor.onSagaCompleted(result)
        } else {
          monitor.onSagaFailed(result)
        }
      })

      const metrics = monitor.getMetrics("AverageSaga")
      expect(metrics).toEqual({
        totalExecutions: 5,
        successfulExecutions: 3,
        failedExecutions: 2,
        totalExecutionTime: 800,
        averageExecutionTime: 160,
      })
    })
  })
})
