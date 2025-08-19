/**
 * GoldSrc Fragmented Response Handler
 *
 * Handles reassembly of fragmented RCON responses from GoldSrc servers.
 */

import type { ILogger } from "@/shared/utils/logger.types"

/**
 * Information about a fragmented packet
 */
export interface FragmentInfo {
  readonly packetId: number
  readonly totalFragments: number
  readonly currentFragment: number
  readonly fragmentByte: number
  readonly data: Buffer
}

/**
 * Result of fragment processing
 */
export type FragmentProcessingResult =
  | { type: "incomplete"; fragmentInfo: FragmentInfo }
  | { type: "complete"; assembledData: Buffer }
  | { type: "invalid"; reason: string }

/**
 * Handles fragmented response reassembly for GoldSrc RCON protocol
 */
export class FragmentedResponseHandler {
  private readonly fragmentStore = new Map<number, Buffer[]>()
  private readonly fragmentTimeouts = new Map<number, NodeJS.Timeout>()
  private readonly FRAGMENT_TIMEOUT = 2000 // 2 seconds

  constructor(private readonly logger: ILogger) {}

  /**
   * Checks if a buffer is a fragmented response
   */
  isFragmentedResponse(buffer: Buffer): boolean {
    return (
      buffer.length > 9 &&
      buffer[0] === 0xfe &&
      buffer[1] === 0xff &&
      buffer[2] === 0xff &&
      buffer[3] === 0xff
    )
  }

  /**
   * Parses fragment information from a fragmented response buffer
   */
  parseFragmentInfo(buffer: Buffer): FragmentInfo | null {
    if (!this.isFragmentedResponse(buffer)) {
      return null
    }

    const packetId = buffer.readInt32LE(4)
    const fragmentByte = buffer[8]

    if (fragmentByte === undefined) {
      this.logger.error("Invalid fragmented response - missing fragment byte")
      return null
    }

    // Based on research: lower nibble = total fragments, upper nibble = current fragment number
    const totalFragments = fragmentByte & 0x0f
    const currentFragment = (fragmentByte >> 4) & 0x0f

    // Extract the actual data (skip the 9-byte fragment header)
    const data = buffer.subarray(9)

    return {
      packetId,
      totalFragments,
      currentFragment,
      fragmentByte,
      data,
    }
  }

  /**
   * Processes a fragment and returns the result
   */
  processFragment(buffer: Buffer): FragmentProcessingResult {
    const fragmentInfo = this.parseFragmentInfo(buffer)

    if (!fragmentInfo) {
      return { type: "invalid", reason: "Not a valid fragmented response" }
    }

    const { packetId, totalFragments, currentFragment, fragmentByte, data } = fragmentInfo

    this.logger.debug(
      `📦 GoldSrc RCON: Processing fragment ${currentFragment}/${totalFragments - 1} of packet ${packetId} (fragmentByte: 0x${fragmentByte.toString(16)})`,
    )

    // Initialize fragment array if needed
    if (!this.fragmentStore.has(packetId)) {
      this.fragmentStore.set(packetId, [])
      this.setupFragmentTimeout(packetId)
    }

    // Store the fragment
    const fragments = this.fragmentStore.get(packetId)!
    fragments[currentFragment] = data

    // Check if we have all fragments
    const receivedCount = fragments.filter((f) => f !== undefined).length

    if (receivedCount === totalFragments) {
      // Complete - assemble and cleanup
      const assembledData = Buffer.concat(fragments.filter((f) => f !== undefined))
      this.cleanup(packetId)

      this.logger.debug(`✅ GoldSrc RCON: Fragment reassembly complete for packet ${packetId}`)

      return { type: "complete", assembledData }
    }

    // Still incomplete
    return { type: "incomplete", fragmentInfo }
  }

  /**
   * Sets up a timeout for fragment collection
   */
  private setupFragmentTimeout(packetId: number): void {
    const timeout = setTimeout(() => {
      this.logger.warn(`⏰ GoldSrc RCON: Fragment timeout for packet ${packetId}`)
      this.cleanup(packetId)
    }, this.FRAGMENT_TIMEOUT)

    this.fragmentTimeouts.set(packetId, timeout)
  }

  /**
   * Cleans up fragment data and timeouts
   */
  private cleanup(packetId: number): void {
    // Clear stored fragments
    this.fragmentStore.delete(packetId)

    // Clear timeout
    const timeout = this.fragmentTimeouts.get(packetId)
    if (timeout) {
      clearTimeout(timeout)
      this.fragmentTimeouts.delete(packetId)
    }
  }

  /**
   * Cleans up all fragments and timeouts
   */
  cleanupAll(): void {
    // Clear all timeouts
    for (const timeout of this.fragmentTimeouts.values()) {
      clearTimeout(timeout)
    }

    // Clear all data
    this.fragmentStore.clear()
    this.fragmentTimeouts.clear()
  }
}
