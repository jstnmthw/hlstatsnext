/**
 * Classic Linux-style logger for HLStats Daemon
 * Provides colored status messages in the format: [ STATUS ] Message
 */

import type { ILogger } from "./logger.types"

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const

// Status types
export type LogStatus = "OK" | "ERROR" | "INFO" | "WARN" | "DEBUG" | "EVENT" | "CHAT" | "QUEUE"

// Log levels ordered by priority (higher number = more verbose)
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log level mapping for status types
const STATUS_LOG_LEVEL: Record<LogStatus, LogLevel> = {
  ERROR: LogLevel.ERROR,
  WARN: LogLevel.WARN,
  INFO: LogLevel.INFO,
  DEBUG: LogLevel.DEBUG,
  OK: LogLevel.INFO, // Treat OK as INFO level
  EVENT: LogLevel.INFO, // Treat EVENT as INFO level
  CHAT: LogLevel.INFO, // Treat CHAT as INFO level
  QUEUE: LogLevel.DEBUG, // Treat QUEUE as DEBUG level
}

// Options for the logger
interface LoggerOptions {
  enableColors?: boolean
  timestamp?: boolean
  showTimestamp?: boolean
  logLevel?: LogLevel
}

export class Logger implements ILogger {
  private enableColors: boolean
  private showTimestamp: boolean
  private logLevel: LogLevel

  constructor(options: LoggerOptions = {}) {
    this.enableColors = options.enableColors ?? true
    this.showTimestamp = options.showTimestamp ?? true
    this.logLevel = options.logLevel ?? this.getLogLevelFromEnv()
  }

  /**
   * Get log level from environment variables
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL || "info"

    switch (envLevel.toLowerCase()) {
      case "error":
        return LogLevel.ERROR
      case "warn":
      case "warning":
        return LogLevel.WARN
      case "info":
        return LogLevel.INFO
      case "debug":
        return LogLevel.DEBUG
      default:
        return LogLevel.INFO
    }
  }

  /**
   * Format the timestamp of the message.
   *
   * @returns The formatted timestamp
   */
  private formatTimestamp(): string {
    if (!this.showTimestamp) {
      return ""
    }

    const now = new Date()
    const timestamp = now
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "")

    if (!this.enableColors) {
      return `[${timestamp}] `
    }

    return `${colors.gray}[${timestamp}]${colors.reset} `
  }

  /**
   * Format the status of the message.
   *
   * @param status - The status of the message
   * @returns The formatted status
   */
  private formatStatus(status: LogStatus): string {
    const statusText = `[ ${status} ]`

    if (!this.enableColors) {
      return statusText
    }

    switch (status) {
      case "OK":
        return `${colors.green}${colors.bright}${statusText}${colors.reset}`
      case "ERROR":
        return `${colors.red}${colors.bright}${statusText}${colors.reset}`
      case "INFO":
        return `${colors.blue}${statusText}${colors.reset}`
      case "WARN":
        return `${colors.yellow}${statusText}${colors.reset}`
      case "DEBUG":
        return `${colors.gray}${statusText}${colors.reset}`
      case "EVENT":
        return `${colors.cyan}${colors.bright}${statusText}${colors.reset}`
      case "CHAT":
        return `${colors.yellow}${colors.bright}${statusText}${colors.reset}`
      case "QUEUE":
        return `${colors.magenta}${colors.bright}${statusText}${colors.reset}`
      default:
        return statusText
    }
  }

  /**
   * Log a message with a status and timestamp.
   *
   * @param status - The status of the message
   * @param message - The message to log
   * @param context - Optional context object to log
   */
  private log(status: LogStatus, message: string, context?: Record<string, unknown>): void {
    // Check if this message should be logged based on current log level
    const messageLevel = STATUS_LOG_LEVEL[status]
    if (messageLevel > this.logLevel) {
      return // Skip logging if message level is more verbose than current log level
    }

    const timestamp = this.formatTimestamp()
    const formattedStatus = this.formatStatus(status)
    const shouldPrintContext = Boolean(context) && this.logLevel === LogLevel.DEBUG

    if (shouldPrintContext) {
      console.log(`${timestamp}${formattedStatus} ${message}`, context)
    } else {
      console.log(`${timestamp}${formattedStatus} ${message}`)
    }
  }

  ok(message: string, context?: Record<string, unknown>): void {
    this.log("OK", message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("ERROR", message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("INFO", message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("WARN", message, context)
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("DEBUG", message, context)
  }

  event(message: string, context?: Record<string, unknown>): void {
    this.log("EVENT", message, context)
  }

  chat(message: string, context?: Record<string, unknown>): void {
    this.log("CHAT", message, context)
  }

  queue(message: string, context?: Record<string, unknown>): void {
    this.log("QUEUE", message, context)
  }

  starting(service: string): void {
    this.info(`Starting ${service}`)
  }

  started(service: string): void {
    this.ok(`${service} started successfully`)
  }

  stopping(service: string): void {
    this.info(`Stopping ${service}`)
  }

  stopped(service: string): void {
    this.ok(`${service} stopped successfully`)
  }

  connecting(service: string): void {
    this.info(`Connecting to ${service}`)
  }

  connected(service: string): void {
    this.ok(`Connected to ${service}`)
  }

  disconnected(service: string): void {
    this.ok(`Disconnected from ${service}`)
  }

  failed(operation: string, error?: string): void {
    const message = error ? `${operation}: ${error}` : operation
    this.error(message)
  }

  ready(message: string): void {
    this.ok(message)
  }

  received(signal: string): void {
    this.info(`Received ${signal}, shutting down gracefully`)
  }

  shutdown(): void {
    this.info("Shutting down HLStats Daemon")
  }

  shutdownComplete(): void {
    this.ok("Daemon shutdown complete")
  }

  fatal(error: string): void {
    this.error(`Fatal error: ${error}`)
  }

  disableTimestamps(): void {
    this.showTimestamp = false
  }

  enableTimestamps(): void {
    this.showTimestamp = true
  }

  disableColors(): void {
    this.enableColors = false
  }

  setColorsEnabled(enabled: boolean): void {
    this.enableColors = enabled
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel
  }

  /**
   * Set the log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  /**
   * Set log level from string (for CLI/API usage)
   */
  setLogLevelFromString(level: string): void {
    switch (level.toLowerCase()) {
      case "error":
        this.logLevel = LogLevel.ERROR
        break
      case "warn":
      case "warning":
        this.logLevel = LogLevel.WARN
        break
      case "info":
        this.logLevel = LogLevel.INFO
        break
      case "debug":
        this.logLevel = LogLevel.DEBUG
        break
      default:
        this.warn(`Unknown log level: ${level}, keeping current level`)
    }
  }
}

// Export a default logger instance
export const logger = new Logger()

// Export the Logger class for custom instances
export default Logger
