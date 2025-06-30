/**
 * Classic Linux-style logger for HLStats Daemon v2
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
export type LogStatus = "OK" | "ERROR" | "INFO" | "WARN" | "DEBUG" | "EVENT" | "CHAT"

// Options for the logger
interface LoggerOptions {
  enableColors?: boolean
  timestamp?: boolean
  showTimestamp?: boolean
}

export class Logger implements ILogger {
  private enableColors: boolean
  private showTimestamp: boolean

  constructor(options: LoggerOptions = {}) {
    this.enableColors = options.enableColors ?? true
    this.showTimestamp = options.showTimestamp ?? true
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
        return `${colors.magenta}${statusText}${colors.reset}`
      case "EVENT":
        return `${colors.cyan}${colors.bright}${statusText}${colors.reset}`
      case "CHAT":
        return `${colors.yellow}${colors.bright}${statusText}${colors.reset}`
      default:
        return statusText
    }
  }

  /**
   * Log a message with a status and timestamp.
   *
   * @param status - The status of the message
   * @param message - The message to log
   */
  private log(status: LogStatus, message: string): void {
    const timestamp = this.formatTimestamp()
    const formattedStatus = this.formatStatus(status)

    console.log(`${timestamp}${formattedStatus} ${message}`)
  }

  ok(message: string): void {
    this.log("OK", message)
  }

  error(message: string): void {
    this.log("ERROR", message)
  }

  info(message: string): void {
    this.log("INFO", message)
  }

  warn(message: string): void {
    this.log("WARN", message)
  }

  debug(message: string): void {
    this.log("DEBUG", message)
  }

  event(message: string): void {
    this.log("EVENT", message)
  }

  chat(message: string): void {
    this.log("CHAT", message)
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
    this.info("Shutting down HLStats Daemon v2")
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
}

// Export a default logger instance
export const logger = new Logger()

// Export the Logger class for custom instances
export default Logger
