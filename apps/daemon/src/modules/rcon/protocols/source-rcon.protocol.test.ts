/**
 * Source RCON Protocol Unit Tests
 *
 * Tests for the Source engine RCON protocol (TCP-based, packet ID auth).
 */

import { createMockLogger } from "@/tests/mocks/logger"
import * as net from "node:net"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RconError, RconProtocolType, SourceRconPacketType } from "../types/rcon.types"
import { SourceRconProtocol } from "./source-rcon.protocol"

// Mock net module
vi.mock("node:net", () => {
  const MockSocket = vi.fn()
  return {
    Socket: MockSocket,
    default: { Socket: MockSocket },
  }
})

function createMockTcpSocket() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

  const socket = {
    connect: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(handler)
      return socket
    }),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(() => {
      listeners.clear()
      return socket
    }),
    destroyed: false,
    _emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) || []
      for (const handler of [...handlers]) {
        handler(...args)
      }
    },
    _listeners: listeners,
  }

  return socket
}

/**
 * Creates a Source RCON response packet buffer.
 */
function createResponsePacket(id: number, type: SourceRconPacketType, body: string): Buffer {
  const bodyBuffer = Buffer.from(body, "ascii")
  const size = 4 + 4 + bodyBuffer.length + 2

  const packet = Buffer.allocUnsafe(4 + size)
  packet.writeInt32LE(size, 0)
  packet.writeInt32LE(id, 4)
  packet.writeInt32LE(type, 8)
  bodyBuffer.copy(packet, 12)
  packet.writeUInt8(0, 12 + bodyBuffer.length)
  packet.writeUInt8(0, 12 + bodyBuffer.length + 1)

  return packet
}

describe("SourceRconProtocol", () => {
  let protocol: SourceRconProtocol
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockSocket: ReturnType<typeof createMockTcpSocket>

  const TEST_TIMEOUT = 200

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = createMockLogger()
    mockSocket = createMockTcpSocket()
    vi.mocked(net.Socket).mockImplementation(() => mockSocket as unknown as net.Socket)
    protocol = new SourceRconProtocol(mockLogger, TEST_TIMEOUT)
  })

  afterEach(async () => {
    try {
      await protocol.disconnect()
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("constructor", () => {
    it("should create an instance with default timeout", () => {
      const p = new SourceRconProtocol(mockLogger)
      expect(p).toBeInstanceOf(SourceRconProtocol)
      expect(p.isConnected()).toBe(false)
    })

    it("should create an instance with custom timeout", () => {
      const p = new SourceRconProtocol(mockLogger, 10000)
      expect(p).toBeInstanceOf(SourceRconProtocol)
    })
  })

  describe("getType", () => {
    it("should return SOURCE protocol type", () => {
      expect(protocol.getType()).toBe(RconProtocolType.SOURCE)
    })
  })

  describe("connect", () => {
    it("should validate address - empty", async () => {
      await expect(protocol.connect("", 27015, "password")).rejects.toThrow(
        "Invalid server address",
      )
    })

    it("should validate address - whitespace", async () => {
      await expect(protocol.connect("  ", 27015, "password")).rejects.toThrow(
        "Invalid server address",
      )
    })

    it("should validate port - zero", async () => {
      await expect(protocol.connect("127.0.0.1", 0, "password")).rejects.toThrow(
        "Invalid server port",
      )
    })

    it("should validate port - too high", async () => {
      await expect(protocol.connect("127.0.0.1", 70000, "password")).rejects.toThrow(
        "Invalid server port",
      )
    })

    it("should validate port - negative", async () => {
      await expect(protocol.connect("127.0.0.1", -1, "password")).rejects.toThrow(
        "Invalid server port",
      )
    })

    it("should validate password - empty", async () => {
      await expect(protocol.connect("127.0.0.1", 27015, "")).rejects.toThrow(
        "Invalid RCON password",
      )
    })

    it("should validate password - whitespace", async () => {
      await expect(protocol.connect("127.0.0.1", 27015, "  ")).rejects.toThrow(
        "Invalid RCON password",
      )
    })

    it("should handle connection timeout", async () => {
      // Never call the connect callback
      mockSocket.connect.mockImplementation(() => {
        // No callback
      })

      await expect(protocol.connect("127.0.0.1", 27015, "pass")).rejects.toThrow(RconError)
      expect(protocol.isConnected()).toBe(false)
    }, 5000)

    it("should handle connection error", async () => {
      mockSocket.connect.mockImplementation(() => {
        queueMicrotask(() => {
          mockSocket._emit("error", new Error("Connection refused"))
        })
      })

      await expect(protocol.connect("127.0.0.1", 27015, "pass")).rejects.toThrow()
      expect(protocol.isConnected()).toBe(false)
    })

    it("should handle auth response with id -1 from processPacket", async () => {
      mockSocket.connect.mockImplementation(
        (_port: number, _address: string, callback: () => void) => {
          queueMicrotask(() => callback())
        },
      )

      mockSocket.write.mockImplementation((packet: Buffer) => {
        const type = packet.readInt32LE(8)
        if (type === SourceRconPacketType.SERVERDATA_AUTH) {
          // Server responds with -1 as id which is AUTH_RESPONSE failure
          // But pendingResponses has the original id, not -1
          // So -1 won't match any pending response - the auth just times out
          // This tests the "no pending response" path in processPacket
          const authResponse = createResponsePacket(
            -1,
            SourceRconPacketType.SERVERDATA_AUTH_RESPONSE,
            "",
          )
          queueMicrotask(() => {
            mockSocket._emit("data", authResponse)
          })
        }
        return true
      })

      // Will timeout because -1 doesn't match any pending ID
      await expect(protocol.connect("127.0.0.1", 27015, "pass")).rejects.toThrow(RconError)
      expect(protocol.isConnected()).toBe(false)
    }, 5000)

    it("should handle establishConnection with null socket", async () => {
      vi.mocked(net.Socket).mockImplementation(() => null as unknown as net.Socket)
      protocol = new SourceRconProtocol(mockLogger, TEST_TIMEOUT)

      await expect(protocol.connect("127.0.0.1", 27015, "pass")).rejects.toThrow()
    })
  })

  describe("disconnect", () => {
    it("should return early if no socket exists", async () => {
      await protocol.disconnect()
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Disconnected from Source RCON"),
      )
    })
  })

  describe("execute", () => {
    it("should throw when not connected", async () => {
      await expect(protocol.execute("status")).rejects.toThrow("Not connected to server")
    })
  })

  describe("sendPacket", () => {
    it("should throw NOT_CONNECTED when socket is null", async () => {
      ;(protocol as unknown as { isConnectedState: boolean }).isConnectedState = true

      await expect(protocol.execute("test")).rejects.toThrow("Not connected")
    })

    it("should throw NOT_CONNECTED when not connected state", async () => {
      ;(protocol as unknown as { socket: unknown }).socket = mockSocket
      ;(protocol as unknown as { isConnectedState: boolean }).isConnectedState = false

      await expect(protocol.execute("test")).rejects.toThrow("Not connected to server")
    })
  })

  describe("socket event handlers", () => {
    it("should handle setupSocketHandlers with null socket", () => {
      const p = new SourceRconProtocol(mockLogger, TEST_TIMEOUT)
      const setupMethod = (
        p as unknown as { setupSocketHandlers: () => void }
      ).setupSocketHandlers.bind(p)

      setupMethod()
      // Should not throw
    })
  })

  describe("getNextPacketId", () => {
    it("should increment packet ID", () => {
      const getNextId = (
        protocol as unknown as { getNextPacketId: () => number }
      ).getNextPacketId.bind(protocol)

      const id1 = getNextId()
      const id2 = getNextId()

      expect(id2).toBe(id1 + 1)
    })
  })

  describe("cleanup", () => {
    it("should handle cleanup when socket is null", async () => {
      const cleanup = (protocol as unknown as { cleanup: () => Promise<void> }).cleanup.bind(
        protocol,
      )

      // Should not throw with null socket
      await cleanup()
    })
  })

  describe("createPacket", () => {
    it("should create a properly formatted packet", () => {
      const createPacket = (
        protocol as unknown as {
          createPacket: (id: number, type: SourceRconPacketType, body: string) => Buffer
        }
      ).createPacket.bind(protocol)

      const packet = createPacket(1, SourceRconPacketType.SERVERDATA_EXECCOMMAND, "status")

      const size = packet.readInt32LE(0)
      const id = packet.readInt32LE(4)
      const type = packet.readInt32LE(8)
      const body = packet.subarray(12, 12 + 6).toString("ascii")

      expect(id).toBe(1)
      expect(type).toBe(SourceRconPacketType.SERVERDATA_EXECCOMMAND)
      expect(body).toBe("status")
      expect(size).toBe(4 + 4 + 6 + 2)
      expect(packet[18]).toBe(0)
      expect(packet[19]).toBe(0)
    })

    it("should handle empty body", () => {
      const createPacket = (
        protocol as unknown as {
          createPacket: (id: number, type: SourceRconPacketType, body: string) => Buffer
        }
      ).createPacket.bind(protocol)

      const packet = createPacket(1, SourceRconPacketType.SERVERDATA_AUTH, "")

      const size = packet.readInt32LE(0)
      expect(size).toBe(4 + 4 + 0 + 2) // id + type + empty body + 2 null terminators
      expect(packet[12]).toBe(0)
      expect(packet[13]).toBe(0)
    })
  })
})
