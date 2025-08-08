/**
 * Ingress Module Types
 */

import type { BaseEvent } from "@/shared/types/events"

export interface IngressOptions {
  port?: number
  host?: string
  skipAuth?: boolean
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
  processRawEvent(
    rawData: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<BaseEvent | null>
  authenticateServer(address: string, port: number): Promise<number | null>
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
