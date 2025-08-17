/**
 * RCON Command Type Definitions
 */

import type { IRconProtocol } from "../rcon.types"

export interface IRconCommand<T = unknown> {
  /**
   * Command name/string to send to server
   */
  readonly name: string

  /**
   * Execute the command using the provided protocol
   */
  execute(protocol: IRconProtocol): Promise<string>

  /**
   * Parse the raw response into structured data
   */
  parse(response: string): T
}

export abstract class BaseRconCommand<T = unknown> implements IRconCommand<T> {
  constructor(public readonly name: string) {}

  async execute(protocol: IRconProtocol): Promise<string> {
    if (!protocol.isConnected()) {
      throw new Error(`Not connected to server for command: ${this.name}`)
    }
    return await protocol.execute(this.name)
  }

  abstract parse(response: string): T
}