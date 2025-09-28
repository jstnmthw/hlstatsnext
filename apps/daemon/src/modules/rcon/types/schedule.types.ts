/**
 * RCON Schedule Module Type Definitions
 *
 * Provides interfaces and types for scheduled RCON command execution.
 */

import type { ScheduledTask } from "node-cron"

// Core Schedule Types
export interface ScheduledCommand {
  /** Unique identifier for the scheduled command */
  readonly id: string

  /** Human-readable name for the command */
  name: string

  /** Cron expression defining when to execute */
  cronExpression: string

  /** Command configuration */
  command: {
    /** Command type identifier */
    type: string
    /** Command-specific configuration */
    [key: string]: unknown
  }

  /** Whether this schedule is currently enabled */
  enabled: boolean

  /** Filter criteria for which servers to target */
  serverFilter?: ServerFilter

  /** Additional metadata for the command */
  metadata?: Record<string, unknown>

  /** Timeout for command execution in milliseconds */
  timeoutMs?: number

  /** Whether to retry failed commands */
  retryOnFailure?: boolean

  /** Maximum number of retry attempts */
  maxRetries?: number
}

export interface ServerFilter {
  /** Specific server IDs to target */
  serverIds?: number[]

  /** Server tags to include */
  tags?: string[]

  /** Game types to target */
  gameTypes?: string[]

  /** Exclude specific server IDs */
  excludeServerIds?: number[]

  /** Minimum number of players required */
  minPlayers?: number

  /** Maximum number of players allowed */
  maxPlayers?: number
}

// Execution Results
export interface ScheduleExecutionResult {
  /** Unique execution ID */
  executionId: string

  /** When execution started */
  startTime: Date

  /** When execution ended */
  endTime: Date

  /** Execution duration in milliseconds */
  duration: number

  /** Execution status */
  status: "success" | "failed"

  /** Number of servers processed */
  serversProcessed: number

  /** Number of commands sent */
  commandsSent: number

  /** Error messages if any */
  errors?: string[]
}

export interface ScheduleExecutionContext {
  /** Schedule ID */
  scheduleId: string

  /** Unique execution ID */
  executionId: string

  /** The scheduled command being executed */
  schedule: ScheduledCommand

  /** When execution started */
  startTime: Date
}

// Service Interfaces
export interface IRconScheduleService {
  /**
   * Start the scheduler and all enabled schedules
   */
  start(): Promise<void>

  /**
   * Stop the scheduler and cleanup all jobs
   */
  stop(): Promise<void>

  /**
   * Register a new scheduled command
   */
  registerSchedule(schedule: ScheduledCommand): Promise<void>

  /**
   * Unregister a scheduled command
   */
  unregisterSchedule(scheduleId: string): Promise<void>

  /**
   * Update an existing scheduled command
   */
  updateSchedule(schedule: ScheduledCommand): Promise<void>

  /**
   * Enable or disable a specific schedule
   */
  setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<void>

  /**
   * Get all registered schedules
   */
  getSchedules(): ScheduledCommand[]

  /**
   * Get execution history for a schedule
   */
  getExecutionHistory(scheduleId: string, limit?: number): ScheduleExecutionResult[]

  /**
   * Get current status of all schedules
   */
  getScheduleStatus(): ScheduleStatus[]

  /**
   * Execute a scheduled command immediately (for testing)
   */
  executeScheduleNow(scheduleId: string): Promise<ScheduleExecutionResult[]>
}

export interface IScheduledCommandExecutor {
  /**
   * Execute a scheduled command
   */
  execute(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }>

  /**
   * Validate command before execution
   */
  validate(schedule: ScheduledCommand): Promise<boolean>

  /**
   * Get command type identifier
   */
  getType(): string
}

// Status and Monitoring
export interface ScheduleStatus {
  /** Schedule ID */
  scheduleId: string

  /** Schedule name */
  name: string

  /** Whether the schedule is enabled */
  enabled: boolean

  /** Cron expression */
  cronExpression: string

  /** Next execution time */
  nextExecution?: Date

  /** Last execution time */
  lastExecution?: Date

  /** Task status */
  status: "scheduled" | "running" | "stopped"

  /** Execution statistics */
  stats: ScheduleJobStats
}

// Configuration
export interface ScheduleConfig {
  /** Whether the scheduler is enabled */
  enabled: boolean

  /** Default timeout for command execution */
  defaultTimeoutMs: number

  /** Default retry settings */
  defaultRetryOnFailure: boolean

  /** Default maximum retries */
  defaultMaxRetries: number

  /** How long to keep execution history */
  historyRetentionHours: number

  /** Maximum number of concurrent executions per server */
  maxConcurrentPerServer: number

  /** Array of scheduled commands */
  schedules: ScheduledCommand[]
}

// Errors
export class ScheduleError extends Error {
  constructor(
    message: string,
    public readonly code: ScheduleErrorCode,
    public readonly scheduleId?: string,
    public readonly serverId?: number,
  ) {
    super(message)
    this.name = "ScheduleError"
  }
}

export enum ScheduleErrorCode {
  INVALID_CRON_EXPRESSION = "INVALID_CRON_EXPRESSION",
  SCHEDULE_NOT_FOUND = "SCHEDULE_NOT_FOUND",
  SCHEDULE_ALREADY_EXISTS = "SCHEDULE_ALREADY_EXISTS",
  EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT",
  EXECUTION_FAILED = "EXECUTION_FAILED",
  SERVER_NOT_AVAILABLE = "SERVER_NOT_AVAILABLE",
  INVALID_COMMAND = "INVALID_COMMAND",
  SCHEDULER_NOT_STARTED = "SCHEDULER_NOT_STARTED",
  SCHEDULE_REGISTRATION_FAILED = "SCHEDULE_REGISTRATION_FAILED",
  SCHEDULE_UNREGISTRATION_FAILED = "SCHEDULE_UNREGISTRATION_FAILED",
  SCHEDULE_UPDATE_FAILED = "SCHEDULE_UPDATE_FAILED",
  SCHEDULE_VALIDATION_FAILED = "SCHEDULE_VALIDATION_FAILED",
  EXECUTOR_NOT_FOUND = "EXECUTOR_NOT_FOUND",
}

// Internal Scheduler Types
export interface ScheduleJob {
  /** The scheduled command definition */
  schedule: ScheduledCommand

  /** The node-cron task instance */
  task: ScheduledTask

  /** Execution statistics */
  stats: ScheduleJobStats

  /** Execution history (limited by retention policy) */
  history: ScheduleExecutionResult[]
}

export interface ScheduleJobStats {
  /** Total number of executions */
  totalExecutions: number

  /** Number of successful executions */
  successfulExecutions: number

  /** Number of failed executions */
  failedExecutions: number

  /** Last execution start time */
  lastExecutionStart?: Date

  /** Last execution end time */
  lastExecutionEnd?: Date

  /** Last execution duration in milliseconds */
  lastExecutionDuration?: number
}

// Command Type Registry
export interface ScheduledCommandType {
  /** Type identifier */
  type: string

  /** Human-readable name */
  name: string

  /** Description of what this command type does */
  description: string

  /** Default configuration for this command type */
  defaultConfig: Partial<ScheduledCommand>

  /** Factory function to create executor */
  createExecutor: () => IScheduledCommandExecutor
}
