/**
 * Ingress Module Types
 */

import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { BaseEvent } from "@/shared/types/events"

export interface IngressOptions {
  port?: number
  host?: string
  logBots?: boolean
}

export interface ServerAuthData {
  serverId: number
  address: string
  port: number
  authKey?: string
}

export interface IIngressService {
  start(): Promise<void>
  stop(): void
  isRunning(): boolean
  getStats(): IngressStats
  setPublisher(publisher: IEventPublisher): void
  /**
   * Process a raw log line from an authenticated server.
   */
  processRawEvent(rawData: string, serverId: number): Promise<BaseEvent | null>
  /**
   * Look up authenticated server by UDP source (for engine log lines).
   */
  authenticateSource(address: string, port: number): number | undefined
  /**
   * Get all currently authenticated server IDs.
   */
  getAuthenticatedServerIds(): number[]
}

export interface IngressStats {
  totalLogsProcessed: number
  totalErrors: number
  startTime?: Date
  uptime?: number
}

export interface IEventParser {
  canParse(logLine: string): boolean
  parse(logLine: string): BaseEvent | null
}
