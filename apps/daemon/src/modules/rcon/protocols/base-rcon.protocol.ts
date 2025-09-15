/**
 * Base RCON Protocol Abstract Class
 *
 * Provides common functionality and enforces interface for all RCON protocol implementations.
 */

import type { IRconProtocol, RconProtocolType } from "../types/rcon.types"
import { RconError, RconErrorCode } from "../types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

export abstract class BaseRconProtocol implements IRconProtocol {
  protected isConnectedState = false
  protected connectionTimeout = 5000 // 5 seconds default
  protected commandTimeout = 3000 // 3 seconds default

  constructor(
    protected readonly logger: ILogger,
    protected readonly timeout?: number,
  ) {
    if (timeout) {
      this.connectionTimeout = timeout
      this.commandTimeout = timeout
    }
  }

  abstract connect(address: string, port: number, password: string): Promise<void>
  abstract disconnect(): Promise<void>
  abstract execute(command: string): Promise<string>
  abstract getType(): RconProtocolType

  isConnected(): boolean {
    return this.isConnectedState
  }

  protected setConnected(connected: boolean): void {
    this.isConnectedState = connected
  }

  protected validateConnection(): void {
    if (!this.isConnected()) {
      throw new RconError("Not connected to server", RconErrorCode.NOT_CONNECTED)
    }
  }

  protected validateAddress(address: string): void {
    if (!address || address.trim() === "") {
      throw new RconError("Invalid server address", RconErrorCode.INVALID_CREDENTIALS)
    }
  }

  protected validatePort(port: number): void {
    if (!port || port < 1 || port > 65535) {
      throw new RconError("Invalid server port", RconErrorCode.INVALID_CREDENTIALS)
    }
  }

  protected validatePassword(password: string): void {
    if (!password || password.trim() === "") {
      throw new RconError("Invalid RCON password", RconErrorCode.INVALID_CREDENTIALS)
    }
  }

  protected createTimeoutPromise<T>(timeoutMs: number, operation: string): Promise<T> {
    return new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new RconError(`${operation} timed out after ${timeoutMs}ms`, RconErrorCode.TIMEOUT))
      }, timeoutMs)
    })
  }

  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    return Promise.race([promise, this.createTimeoutPromise<T>(timeoutMs, operation)])
  }
}
