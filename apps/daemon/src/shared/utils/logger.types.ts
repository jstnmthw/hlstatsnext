/**
 * Interface for the Logger class.
 * This allows for dependency injection and mocking of the logger in tests.
 */
export interface ILogger {
  ok(message: string): void
  error(message: string): void
  info(message: string): void
  warn(message: string): void
  debug(message: string): void
  event(message: string): void
  chat(message: string): void
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
}
