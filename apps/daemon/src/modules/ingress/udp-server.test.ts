/**
 * UdpServer Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "events"
import { UdpServer } from "./udp-server"
import { createMockLogger } from "../../test-support/mocks/logger"
import type { UdpServerOptions, ISocketFactory } from "./udp-server"
import type { Socket } from "dgram"

// Create a mock socket
const mockSocket = {
  bind: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  address: vi.fn(() => ({ address: "0.0.0.0", family: "IPv4", port: 30000 })),
  listening: false,
} as unknown as Socket

// Create a mock socket factory
const mockSocketFactory: ISocketFactory = {
  createSocket: vi.fn(() => mockSocket),
}

describe("UdpServer", () => {
  let udpServer: UdpServer
  let mockLogger: ReturnType<typeof createMockLogger>
  let options: UdpServerOptions

  beforeEach(() => {
    mockLogger = createMockLogger()
    options = {
      port: Math.floor(Math.random() * 10000) + 30000,
      host: "0.0.0.0",
    }

    // Reset all mocks
    vi.clearAllMocks()

    // Restore the socket factory mock
    mockSocketFactory.createSocket = vi.fn(() => mockSocket)

    // Set up default mock behaviors
    mockSocket.bind.mockImplementation((port: number, host: string, callback: () => void) => {
      mockSocket.listening = true
      if (callback) setImmediate(callback)
    })

    mockSocket.close.mockImplementation((callback) => {
      mockSocket.listening = false
      if (callback) setImmediate(callback)
    })

    mockSocket.on.mockReturnValue(mockSocket)

    udpServer = new UdpServer(options, mockLogger, mockSocketFactory)
  })

  afterEach(async () => {
    if (udpServer.isListening()) {
      await udpServer.stop()
    }
  })

  describe("Server instantiation", () => {
    it("should create server instance with options", () => {
      expect(udpServer).toBeDefined()
      expect(udpServer).toBeInstanceOf(UdpServer)
      expect(udpServer).toBeInstanceOf(EventEmitter)
    })

    it("should use default host when not provided", () => {
      const serverWithDefaults = new UdpServer({ port: 27015 }, mockLogger, mockSocketFactory)
      expect(serverWithDefaults).toBeDefined()
    })

    it("should store provided options", () => {
      const customOptions = {
        port: 8080,
        host: "127.0.0.1",
      }
      const customServer = new UdpServer(customOptions, mockLogger, mockSocketFactory)

      expect((customServer as unknown as { options: UdpServerOptions }).options.port).toBe(8080)
      expect((customServer as unknown as { options: UdpServerOptions }).options.host).toBe(
        "127.0.0.1",
      )
    })
  })

  describe("Server lifecycle", () => {
    it("should start server successfully", async () => {
      await udpServer.start()

      expect(mockSocketFactory.createSocket).toHaveBeenCalledWith("udp4")
      expect(mockSocket.bind).toHaveBeenCalledWith(options.port, options.host, expect.any(Function))
      expect(mockLogger.info).toHaveBeenCalledWith(
        `UDP server listening on ${options.host}:${options.port}`,
      )
    })

    it("should set up event handlers", async () => {
      await udpServer.start()

      expect(mockSocket.on).toHaveBeenCalledWith("message", expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function))
    })

    it("should stop server successfully", async () => {
      await udpServer.start()
      await udpServer.stop()

      expect(mockSocket.close).toHaveBeenCalledWith(expect.any(Function))
      expect(mockLogger.info).toHaveBeenCalledWith("UDP server stopped")
    })

    it("should handle stop when server not running", async () => {
      await udpServer.stop()

      expect(mockSocket.close).not.toHaveBeenCalled()
      expect(mockLogger.info).not.toHaveBeenCalledWith("UDP server stopped")
    })
  })

  describe("State management", () => {
    it("should return false when server not started", () => {
      expect(udpServer.isListening()).toBe(false)
    })

    it("should return true when server is running", async () => {
      await udpServer.start()
      expect(udpServer.isListening()).toBe(true)
    })

    it("should return false after server is stopped", async () => {
      await udpServer.start()
      expect(udpServer.isListening()).toBe(true)

      await udpServer.stop()
      expect(udpServer.isListening()).toBe(false)
    })
  })

  describe("Error handling", () => {
    it("should handle bind errors", async () => {
      const bindError = new Error("Port already in use")
      mockSocket.bind.mockImplementationOnce((port, host, callback) => {
        throw bindError
      })

      await expect(udpServer.start()).rejects.toThrow("Port already in use")
    })

    it("should handle socket creation errors", async () => {
      mockSocketFactory.createSocket = vi.fn(() => {
        throw new Error("Failed to create socket")
      })

      await expect(udpServer.start()).rejects.toThrow("Failed to create socket")
    })
  })

  describe("Event emission", () => {
    it("should emit logReceived events from message handler", async () => {
      const logReceivedSpy = vi.fn()
      udpServer.on("logReceived", logReceivedSpy)

      await udpServer.start()

      // Get the message handler that was registered
      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1]

      // Simulate incoming message
      if (messageHandler) {
        const buffer = Buffer.from("Test log line", "utf8")
        const rinfo = { address: "192.168.1.100", port: 27015 }

        messageHandler(buffer, rinfo)

        expect(logReceivedSpy).toHaveBeenCalledWith({
          logLine: "Test log line",
          serverAddress: "192.168.1.100",
          serverPort: 27015,
          timestamp: expect.any(Date),
        })
      }
    })

    it("should emit error events from error handler", async () => {
      const errorSpy = vi.fn()
      udpServer.on("error", errorSpy)

      await udpServer.start()

      // Get the error handler that was registered
      const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === "error")?.[1]

      // Simulate error
      if (errorHandler) {
        const testError = new Error("UDP socket error")
        errorHandler(testError)

        expect(mockLogger.error).toHaveBeenCalledWith("UDP server error: UDP socket error")
        expect(errorSpy).toHaveBeenCalledWith(testError)
      }
    })

    it("should ignore empty messages", async () => {
      const logReceivedSpy = vi.fn()
      udpServer.on("logReceived", logReceivedSpy)

      await udpServer.start()

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1]

      if (messageHandler) {
        // Test empty and whitespace-only messages
        const emptyBuffer = Buffer.from("   \n  ", "utf8")
        const rinfo = { address: "192.168.1.100", port: 27015 }

        messageHandler(emptyBuffer, rinfo)

        expect(logReceivedSpy).not.toHaveBeenCalled()
      }
    })
  })
})
