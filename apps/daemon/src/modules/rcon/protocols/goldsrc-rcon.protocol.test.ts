/**
 * GoldSrc RCON Protocol Unit Tests
 *
 * Tests for the GoldSource engine RCON protocol (UDP-based, challenge-response auth).
 * Uses direct internal state manipulation for connect-dependent tests to avoid
 * complex async mock timing issues with UDP socket event simulation.
 */

import { createMockLogger } from "@/tests/mocks/logger"
import * as dgram from "node:dgram"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RconError, RconProtocolType } from "../types/rcon.types"
import { GoldSrcRconProtocol } from "./goldsrc-rcon.protocol"

// Mock dgram module
vi.mock("node:dgram", () => ({
  createSocket: vi.fn(),
}))

// Mock handlers - must track instances for per-test access
let mockParseCommandResponse: ReturnType<typeof vi.fn>
let mockIsFragmentedResponse: ReturnType<typeof vi.fn>
let mockProcessFragment: ReturnType<typeof vi.fn>
let mockCleanupAll: ReturnType<typeof vi.fn>

vi.mock("../handlers/command-response.handler", () => ({
  CommandResponseHandler: vi.fn().mockImplementation(() => {
    mockParseCommandResponse = vi.fn().mockReturnValue({ type: "success", response: "OK" })
    return { parseCommandResponse: mockParseCommandResponse }
  }),
}))

vi.mock("../handlers/fragment-response.handler", () => ({
  FragmentedResponseHandler: vi.fn().mockImplementation(() => {
    mockIsFragmentedResponse = vi.fn().mockReturnValue(false)
    mockProcessFragment = vi.fn()
    mockCleanupAll = vi.fn()
    return {
      isFragmentedResponse: mockIsFragmentedResponse,
      processFragment: mockProcessFragment,
      cleanupAll: mockCleanupAll,
    }
  }),
}))

interface MockSocket {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  bind: ReturnType<typeof vi.fn>
  address: ReturnType<typeof vi.fn>
  _listeners: Map<string, ((...args: unknown[]) => void)[]>
  emit: (event: string, ...args: unknown[]) => void
}

function createMockSocket(): MockSocket {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

  const socket: MockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(handler)
      return socket
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const h = listeners.get(event) || []
      const idx = h.indexOf(handler)
      if (idx >= 0) h.splice(idx, 1)
      return socket
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const h = listeners.get(event) || []
      const idx = h.indexOf(handler)
      if (idx >= 0) h.splice(idx, 1)
      return socket
    }),
    removeAllListeners: vi.fn(() => {
      listeners.clear()
      return socket
    }),
    send: vi.fn(),
    close: vi.fn(),
    bind: vi.fn(),
    address: vi.fn().mockReturnValue({ address: "0.0.0.0", port: 12345 }),
    _listeners: listeners,
    emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) || []
      for (const handler of [...handlers]) {
        handler(...args)
      }
    },
  }

  return socket
}

// Type for accessing private members in tests
interface ProtocolInternals {
  socket: MockSocket | null
  challenge: string | null
  isConnectedState: boolean
  serverAddress: string
  serverPort: number
  rconPassword: string
  setupSocketHandlers: () => void
  fragmentHandler: { cleanupAll: () => void }
}

describe("GoldSrcRconProtocol", () => {
  let protocol: GoldSrcRconProtocol
  let internals: ProtocolInternals
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockSocket: MockSocket

  const TEST_TIMEOUT = 200

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = createMockLogger()
    mockSocket = createMockSocket()
    vi.mocked(dgram.createSocket).mockReturnValue(mockSocket as unknown as dgram.Socket)
    protocol = new GoldSrcRconProtocol(mockLogger, TEST_TIMEOUT)
    internals = protocol as unknown as ProtocolInternals
  })

  afterEach(async () => {
    // Clean up any pending timers
    internals.isConnectedState = false
    internals.socket = null
    internals.challenge = null
  })

  const rinfo = { address: "127.0.0.1", port: 27015, family: "IPv4", size: 0 }

  /**
   * Sets internal state as if connect() succeeded, avoiding UDP mock timing issues.
   */
  function simulateConnected(challengeValue = "42") {
    internals.socket = mockSocket
    internals.challenge = challengeValue
    internals.isConnectedState = true
    internals.serverAddress = "127.0.0.1"
    internals.serverPort = 27015
    internals.rconPassword = "pass"
    // Register socket event handlers as connect() would
    internals.setupSocketHandlers()
  }

  describe("constructor", () => {
    it("should create an instance with default timeout", () => {
      const p = new GoldSrcRconProtocol(mockLogger)
      expect(p).toBeInstanceOf(GoldSrcRconProtocol)
      expect(p.isConnected()).toBe(false)
    })

    it("should create an instance with custom timeout", () => {
      const p = new GoldSrcRconProtocol(mockLogger, 10000)
      expect(p).toBeInstanceOf(GoldSrcRconProtocol)
    })
  })

  describe("getType", () => {
    it("should return GOLDSRC protocol type", () => {
      expect(protocol.getType()).toBe(RconProtocolType.GOLDSRC)
    })
  })

  describe("connect", () => {
    it("should validate address - empty string", async () => {
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

    it("should handle challenge request timeout", async () => {
      mockSocket.send.mockImplementation((...args: unknown[]) => {
        const callback = args[args.length - 1] as ((err: Error | null) => void) | undefined
        if (typeof callback === "function") callback(null)
        // No response
      })

      await expect(protocol.connect("127.0.0.1", 27015, "pass")).rejects.toThrow(RconError)
      expect(protocol.isConnected()).toBe(false)
    }, 5000)
  })

  describe("disconnect", () => {
    it("should return early if no socket exists", async () => {
      await protocol.disconnect()
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Disconnected from GoldSource"),
      )
    })

    it("should disconnect and clean up", async () => {
      simulateConnected()
      expect(protocol.isConnected()).toBe(true)

      await protocol.disconnect()

      expect(protocol.isConnected()).toBe(false)
      expect(mockSocket.removeAllListeners).toHaveBeenCalled()
      expect(mockSocket.close).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith("Disconnected from GoldSource RCON server")
    })
  })

  describe("execute", () => {
    it("should throw when not connected", async () => {
      await expect(protocol.execute("status")).rejects.toThrow("Not connected to server")
    })

    it("should throw for empty command", async () => {
      simulateConnected()
      await expect(protocol.execute("")).rejects.toThrow("Command cannot be empty")
    })

    it("should throw for whitespace-only command", async () => {
      simulateConnected()
      await expect(protocol.execute("   ")).rejects.toThrow("Command cannot be empty")
    })

    it("should throw when no challenge is available", async () => {
      simulateConnected()
      internals.challenge = null
      await expect(protocol.execute("status")).rejects.toThrow("No challenge available")
    })

    it("should handle command timeout", async () => {
      simulateConnected()

      mockSocket.send.mockImplementation((...args: unknown[]) => {
        const callback = args[args.length - 1] as ((err: Error | null) => void) | undefined
        if (typeof callback === "function") callback(null)
        // No response
      })

      await expect(protocol.execute("status")).rejects.toThrow(RconError)
    }, 5000)

    it("should handle send error during command execution", async () => {
      simulateConnected()

      mockSocket.send.mockImplementation((...args: unknown[]) => {
        const callback = args[args.length - 1] as ((err: Error | null) => void) | undefined
        if (typeof callback === "function") callback(new Error("Send failed"))
      })

      await expect(protocol.execute("status")).rejects.toThrow("Failed to send command")
    })

    it("should trim command before sending", async () => {
      simulateConnected()

      const sentBuffers: Buffer[] = []
      mockSocket.send.mockImplementation((...args: unknown[]) => {
        sentBuffers.push(Buffer.from(args[0] as Buffer))
        const callback = args[args.length - 1] as ((err: Error | null) => void) | undefined
        if (typeof callback === "function") callback(null)
        mockSocket.emit("message", Buffer.from("\xff\xff\xff\xff\x6cOK\x00", "latin1"), rinfo)
      })

      await protocol.execute("  status  ")

      const content = sentBuffers[0]!.toString("latin1", 4)
      expect(content).toBe("rcon 42 pass status\n")
    })
  })

  describe("socket event handlers", () => {
    it("should handle socket close event", async () => {
      simulateConnected()
      expect(protocol.isConnected()).toBe(true)

      mockSocket.emit("close")

      expect(protocol.isConnected()).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("GoldSource RCON socket closed"),
      )
    })

    it("should handle socket listening event", async () => {
      simulateConnected()
      mockSocket.emit("listening")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("GoldSource RCON socket listening"),
      )
    })

    it("should handle setupSocketHandlers with null socket", () => {
      internals.socket = null
      internals.setupSocketHandlers()
      // Should not throw
    })
  })

  describe("sendRconCommand edge cases", () => {
    it("should throw NOT_CONNECTED when socket is null", async () => {
      internals.isConnectedState = true
      internals.challenge = "123"
      internals.socket = null
      await expect(protocol.execute("status")).rejects.toThrow("Not connected")
    })

    it("should throw when challenge is null", async () => {
      internals.socket = mockSocket
      internals.isConnectedState = true
      internals.challenge = null
      await expect(protocol.execute("status")).rejects.toThrow("No challenge available")
    })
  })

  describe("createCommandBuffer", () => {
    it("should create properly formatted buffer", async () => {
      simulateConnected("42")

      const sentBuffers: Buffer[] = []
      mockSocket.send.mockImplementation((...args: unknown[]) => {
        sentBuffers.push(Buffer.from(args[0] as Buffer))
        const callback = args[args.length - 1] as ((err: Error | null) => void) | undefined
        if (typeof callback === "function") callback(null)
        mockSocket.emit("message", Buffer.from("\xff\xff\xff\xff\x6cOK\x00", "latin1"), rinfo)
      })

      await protocol.execute("status")

      const buf = sentBuffers[0]!
      expect(buf[0]).toBe(0xff)
      expect(buf[1]).toBe(0xff)
      expect(buf[2]).toBe(0xff)
      expect(buf[3]).toBe(0xff)
      expect(buf.toString("latin1", 4)).toBe("rcon 42 pass status\n")
    })
  })
})
