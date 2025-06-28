/**
 * Classic Linux-style logger for HLStats Daemon v2
 * Provides colored status messages in the format: [ STATUS ] Message
 */

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
} as const;

// Status types
export type LogStatus = "OK" | "ERROR" | "INFO" | "WARN" | "DEBUG";

interface LoggerOptions {
  enableColors?: boolean;
  timestamp?: boolean;
  showTimestamp?: boolean;
}

export class Logger {
  private enableColors: boolean;
  private showTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.enableColors = options.enableColors ?? true;
    this.showTimestamp = options.showTimestamp ?? true;
  }

  private formatTimestamp(): string {
    if (!this.showTimestamp) {
      return "";
    }

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "");

    if (!this.enableColors) {
      return `[${timestamp}] `;
    }

    return `${colors.gray}[${timestamp}]${colors.reset} `;
  }

  private formatStatus(status: LogStatus): string {
    // Pad status to ensure consistent alignment
    const statusText = `[ ${status.padEnd(1)} ]`;

    if (!this.enableColors) {
      return statusText;
    }

    switch (status) {
      case "OK":
        return `${colors.green}${colors.bright}${statusText}${colors.reset}`;
      case "ERROR":
        return `${colors.red}${colors.bright}${statusText}${colors.reset}`;
      case "INFO":
        return `${colors.blue}${statusText}${colors.reset}`;
      case "WARN":
        return `${colors.yellow}${statusText}${colors.reset}`;
      case "DEBUG":
        return `${colors.magenta}${statusText}${colors.reset}`;
      default:
        return statusText;
    }
  }

  private log(status: LogStatus, message: string): void {
    const timestamp = this.formatTimestamp();
    const formattedStatus = this.formatStatus(status);

    // Ensure consistent spacing and alignment
    console.log(`${timestamp}${formattedStatus} ${message}`);
  }

  ok(message: string): void {
    this.log("OK", message);
  }

  error(message: string): void {
    this.log("ERROR", message);
  }

  info(message: string): void {
    this.log("INFO", message);
  }

  warn(message: string): void {
    this.log("WARN", message);
  }

  debug(message: string): void {
    this.log("DEBUG", message);
  }

  // Special methods for common daemon operations
  starting(service: string): void {
    this.info(`Starting ${service}`);
  }

  started(service: string): void {
    this.ok(`${service} started successfully`);
  }

  stopping(service: string): void {
    this.info(`Stopping ${service}`);
  }

  stopped(service: string): void {
    this.ok(`${service} stopped successfully`);
  }

  connecting(service: string): void {
    this.info(`Connecting to ${service}`);
  }

  connected(service: string): void {
    this.ok(`Connected to ${service}`);
  }

  disconnected(service: string): void {
    this.ok(`Disconnected from ${service}`);
  }

  failed(operation: string, error?: string): void {
    const message = error ? `${operation}: ${error}` : operation;
    this.error(message);
  }

  ready(message: string): void {
    this.ok(message);
  }

  received(signal: string): void {
    this.info(`Received ${signal}, shutting down gracefully`);
  }

  shutdown(): void {
    this.info("Shutting down HLStats Daemon v2");
  }

  shutdownComplete(): void {
    this.ok("Daemon shutdown complete");
  }

  fatal(error: string): void {
    this.error(`Fatal error: ${error}`);
  }

  // Method to disable timestamps for testing or specific use cases
  disableTimestamps(): void {
    this.showTimestamp = false;
  }

  // Method to enable timestamps
  enableTimestamps(): void {
    this.showTimestamp = true;
  }

  // Method to disable colors (useful for log files)
  disableColors(): void {
    this.enableColors = false;
  }

  // Method to enable colors
  setColorsEnabled(enabled: boolean): void {
    this.enableColors = enabled;
  }
}

// Export a default logger instance
export const logger = new Logger();

// Export the Logger class for custom instances
export default Logger;
