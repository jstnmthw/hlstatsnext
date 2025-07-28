/**
 * Interface for the Logger class.
 * This allows for dependency injection and mocking of the logger in tests.
 */
export interface ILogger {
  ok(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
  event(message: string, context?: Record<string, unknown>): void
  chat(message: string, context?: Record<string, unknown>): void
  starting(service: string): void
  started(service: string): void
  stopping(service: string): void
  stopped(service: string): void
  connecting(service: string): void
  connected(service: string): void
  disconnected(service: string): void
  failed(operation: string, error?: string): void
  ready(message: string): void
  received(signal: string): void
  shutdown(): void
  shutdownComplete(): void
  fatal(error: string): void
  disableTimestamps(): void
  enableTimestamps(): void
  disableColors(): void
  setColorsEnabled(enabled: boolean): void
  getLogLevel(): import('./logger').LogLevel
  setLogLevel(level: import('./logger').LogLevel): void
  setLogLevelFromString(level: string): void
}
