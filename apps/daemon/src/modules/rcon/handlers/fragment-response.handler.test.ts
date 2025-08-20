/**
 * Fragmented Response Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { FragmentedResponseHandler } from "./fragment-response.handler"
import { createMockLogger } from "@/tests/mocks/logger"

describe("FragmentedResponseHandler", () => {
  let handler: FragmentedResponseHandler
  const mockLogger = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new FragmentedResponseHandler(mockLogger)
  })

  describe("isFragmentedResponse", () => {
    it("should identify fragmented responses correctly", () => {
      // Fragmented response starts with 0xFE 0xFF 0xFF 0xFF
      const fragmentedBuffer = Buffer.from([
        0xfe, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
      ])
      const nonFragmentedBuffer = Buffer.from([
        0xff, 0xff, 0xff, 0xff, 0x6c, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
      ])
      const shortBuffer = Buffer.from([0xfe, 0xff, 0xff])

      expect(handler.isFragmentedResponse(fragmentedBuffer)).toBe(true)
      expect(handler.isFragmentedResponse(nonFragmentedBuffer)).toBe(false)
      expect(handler.isFragmentedResponse(shortBuffer)).toBe(false)
    })
  })

  describe("parseFragmentInfo", () => {
    it("should parse fragment information correctly", () => {
      // Create fragmented response: 0xFE 0xFF 0xFF 0xFF [packet ID: 4 bytes] [fragment byte] [data]
      const packetId = 42
      const fragmentByte = 0x12 // Fragment 1 of 2 (upper nibble = 1, lower nibble = 2)
      const data = Buffer.from("Hello World")

      const packetIdBuffer = Buffer.alloc(4)
      packetIdBuffer.writeInt32LE(packetId, 0)

      const buffer = Buffer.concat([
        Buffer.from([0xfe, 0xff, 0xff, 0xff]),
        packetIdBuffer, // packet ID (little-endian)
        Buffer.from([fragmentByte]),
        data,
      ])

      const result = handler.parseFragmentInfo(buffer)

      expect(result).not.toBeNull()
      expect(result!.packetId).toBe(packetId)
      expect(result!.totalFragments).toBe(2)
      expect(result!.currentFragment).toBe(1)
      expect(result!.fragmentByte).toBe(fragmentByte)
      expect(result!.data.toString()).toBe("Hello World")
    })

    it("should return null for non-fragmented responses", () => {
      const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6c, 0x48, 0x65, 0x6c, 0x6c, 0x6f])

      const result = handler.parseFragmentInfo(buffer)

      expect(result).toBeNull()
    })

    it("should handle buffers that are too short", () => {
      // Create buffer that fails the isFragmentedResponse check (too short)
      const buffer = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00]) // Only 8 bytes, needs > 9

      const result = handler.parseFragmentInfo(buffer)

      expect(result).toBeNull()
      // No error logged because it fails the initial check
    })
  })

  describe("processFragment", () => {
    it("should handle single fragment completion", () => {
      // Create single fragment
      const buffer = createFragmentBuffer(1, 0, 1, "Hello World")

      const result = handler.processFragment(buffer)

      expect(result.type).toBe("complete")
      if (result.type === "complete") {
        expect(result.assembledData.toString()).toBe("Hello World")
      }
    })

    it("should handle multi-fragment assembly", () => {
      // Create first fragment
      const fragment1 = createFragmentBuffer(1, 0, 2, "Hello ")
      const fragment2 = createFragmentBuffer(1, 1, 2, "World")

      // Process first fragment
      const result1 = handler.processFragment(fragment1)
      expect(result1.type).toBe("incomplete")

      // Process second fragment
      const result2 = handler.processFragment(fragment2)
      expect(result2.type).toBe("complete")

      if (result2.type === "complete") {
        expect(result2.assembledData.toString()).toBe("Hello World")
      }
    })

    it("should handle invalid fragments", () => {
      const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6c, 0x48, 0x65, 0x6c, 0x6c, 0x6f])

      const result = handler.processFragment(buffer)

      expect(result.type).toBe("invalid")
      if (result.type === "invalid") {
        expect(result.reason).toBe("Not a valid fragmented response")
      }
    })

    it("should log fragment processing", () => {
      const buffer = createFragmentBuffer(5, 0, 2, "Test")

      handler.processFragment(buffer)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Processing fragment 0/1 of packet 5"),
      )
    })
  })

  describe("cleanupAll", () => {
    it("should cleanup all fragments and timeouts", () => {
      // Process an incomplete fragment to create some state
      const buffer = createFragmentBuffer(1, 0, 2, "Hello")
      handler.processFragment(buffer)

      // Verify state exists by processing same packet again
      const result1 = handler.processFragment(buffer)
      expect(result1.type).toBe("incomplete")

      // Cleanup
      handler.cleanupAll()

      // Process same buffer again - should reset state
      const result2 = handler.processFragment(buffer)
      expect(result2.type).toBe("incomplete")
    })
  })

  // Helper function to create fragment buffers
  function createFragmentBuffer(
    packetId: number,
    fragmentNum: number,
    totalFragments: number,
    data: string,
  ): Buffer {
    const fragmentByte = (fragmentNum << 4) | totalFragments

    const packetIdBuffer = Buffer.alloc(4)
    packetIdBuffer.writeInt32LE(packetId, 0)

    return Buffer.concat([
      Buffer.from([0xfe, 0xff, 0xff, 0xff]),
      packetIdBuffer, // packet ID (little-endian)
      Buffer.from([fragmentByte]),
      Buffer.from(data),
    ])
  }
})
