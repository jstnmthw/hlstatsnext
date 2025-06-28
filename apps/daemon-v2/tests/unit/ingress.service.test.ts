import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks -----------------------------------------------------------------

// Mock UdpServer with basic start/stop/on methods.
const startMock = vi.fn().mockResolvedValue(undefined)
const stopMock = vi.fn().mockResolvedValue(undefined)
const onMock = vi.fn()

vi.mock("@/services/ingress/udp-server", () => {
  return {
    UdpServer: vi.fn().mockImplementation(() => ({
      start: startMock,
      stop: stopMock,
      on: onMock,
    })),
  }
})

// Mock DatabaseClient so no real DB hits occur.
vi.mock("@/database/client", () => {
  return {
    DatabaseClient: vi.fn().mockImplementation(() => ({
      getServerByAddress: vi.fn().mockResolvedValue({ serverId: 1 }),
    })),
  }
})

// Mock CsParser to control its behavior
const canParseMock = vi.fn().mockReturnValue(true)
const parseMock = vi.fn().mockResolvedValue({
  success: true,
  event: { eventType: "PLAYER_CONNECT", serverId: 1, data: {} },
})
vi.mock("@/services/ingress/parsers/cs.parser", () => {
  return {
    CsParser: vi.fn().mockImplementation(() => ({
      canParse: canParseMock,
      parse: parseMock,
    })),
  }
})

import { IngressService } from "../../src/services/ingress/ingress.service"
import { DatabaseClient } from "../../src/database/client"
import { EventProcessorService } from "@/services/processor/processor.service"

// Mock processor with a stubbed processEvent
const processEventMock = vi.fn().mockResolvedValue(undefined)
const processorStub = {
  processEvent: processEventMock,
} as unknown as EventProcessorService

// ---------------------------------------------------------------------------

describe("IngressService", () => {
  let ingress: IngressService

  beforeEach(() => {
    ingress = new IngressService(27500, processorStub)
    vi.clearAllMocks()
  })

  it("start() initialises underlying UDP server", async () => {
    await ingress.start()
    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it("stop() shuts down underlying UDP server", async () => {
    await ingress.start()
    await ingress.stop()
    expect(stopMock).toHaveBeenCalledTimes(1)
  })

  it("handles logReceived events and forwards to processor", async () => {
    await ingress.start()

    // Find the logReceived handler registered via onMock.
    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    // Send first packet (authentication) - should not trigger processEvent
    await handler({
      logLine: 'L 07/15/2024 - 22:33:10: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
      timestamp: new Date(),
    })

    // Second packet should be processed
    await handler({
      logLine: 'L 07/15/2024 - 22:33:12: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
      timestamp: new Date(),
    })

    expect(processEventMock).toHaveBeenCalledTimes(1)
  })

  it("should reject traffic from an unknown server", async () => {
    // Override DB mock for this test
    const dbInstance = new DatabaseClient()
    vi.mocked(dbInstance.getServerByAddress).mockResolvedValue(null)

    // We need a new ingress service instance to use the new DB mock
    ingress = new IngressService(27500, processorStub, dbInstance)
    await ingress.start()

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    await handler({
      logLine: "any log line",
      serverAddress: "1.1.1.1",
      serverPort: 1111,
    })

    expect(processEventMock).not.toHaveBeenCalled()
  })

  it("should ignore lines the parser cannot handle", async () => {
    await ingress.start()
    canParseMock.mockReturnValueOnce(false) // Make the next call fail

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    // Authenticate first
    await handler({
      logLine: "auth",
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    // This call should be ignored
    await handler({
      logLine: "bad line",
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    expect(processEventMock).not.toHaveBeenCalled()
  })

  it("should ignore parser errors", async () => {
    await ingress.start()
    parseMock.mockResolvedValueOnce({
      success: false,
      error: "Test Parser Error",
    })

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    // Authenticate first
    await handler({
      logLine: "auth",
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    // This call should be ignored
    await handler({
      logLine: "parse fail line",
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    expect(processEventMock).not.toHaveBeenCalled()
  })
})

/**
 * Dev environment behaviour - skipAuth & auto server registration
 */
describe("IngressService - dev skipAuth auto-registration", () => {
  const serverCreateMock = vi.fn().mockResolvedValue({ serverId: 42 })

  const dbMock = {
    getServerByAddress: vi.fn().mockResolvedValue(null),
    prisma: {
      server: {
        create: serverCreateMock,
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  } as unknown as DatabaseClient

  let ingress: IngressService

  beforeEach(() => {
    vi.clearAllMocks()
    ingress = new IngressService(27500, processorStub, dbMock, {
      skipAuth: true,
    })
  })

  it("creates a server row on first unseen ip:port and caches it", async () => {
    await ingress.start()

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    const payload = {
      logLine: 'L 01/01/2025 - 12:00:03: "RealGuy<3><STEAM_1:1:222><TERRORIST>" connected, address "8.8.8.8:27005"',
      serverAddress: "172.17.0.2",
      serverPort: 27015,
      timestamp: new Date(),
    }

    await handler(payload)

    expect(serverCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ address: "172.17.0.2", port: 27015 }),
      }),
    )

    // Second packet should not call create again (cached)
    await handler(payload)
    expect(serverCreateMock).toHaveBeenCalledTimes(1)
  })
})

/**
 * Additional coverage for dev skipAuth behaviour and race-condition handling
 */
describe("IngressService - skipAuth immediate processing & race condition", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure parser mocks are back to successful state
    canParseMock.mockReset().mockReturnValue(true)
    parseMock.mockReset().mockResolvedValue({
      success: true,
      event: { eventType: "PLAYER_CONNECT", serverId: 1, data: {} },
    })
  })

  it("processes first packet immediately when skipAuth=true", async () => {
    const dbMock = {
      getServerByAddress: vi.fn().mockResolvedValue({ serverId: 99 }),
      prisma: {
        server: {
          create: vi.fn(),
        },
      },
    } as unknown as DatabaseClient

    const ingress = new IngressService(27500, processorStub, dbMock, {
      skipAuth: true,
    })

    await ingress.start()

    // Find the logReceived handler registered via onMock.
    const handler = onMock.mock.calls.find((c) => c[0] === "logReceived")![1]

    const beforeCount = processEventMock.mock.calls.length

    await handler({
      logLine: "first line",
      serverAddress: "10.0.0.1",
      serverPort: 27015,
    })

    expect(processEventMock.mock.calls.length).toBe(beforeCount + 1)
  })

  it("falls back to existing server row when unique constraint race occurs", async () => {
    const createMock = vi
      .fn()
      // First call: throw unique constraint error
      .mockRejectedValueOnce({ code: "P2002" })
      // Should not be called again
      .mockResolvedValue({ serverId: 123 })

    const dbMock = {
      getServerByAddress: vi
        .fn()
        .mockResolvedValueOnce(null) // Before insert, record doesn't exist
        .mockResolvedValueOnce({ serverId: 55 }), // After race, record exists
      prisma: {
        server: {
          create: createMock,
        },
      },
    } as unknown as DatabaseClient

    const ingress = new IngressService(27500, processorStub, dbMock, {
      skipAuth: true,
    })

    await ingress.start()

    const handler = onMock.mock.calls.find((c) => c[0] === "logReceived")![1]

    const beforeCreate = createMock.mock.calls.length
    const beforeProcess = processEventMock.mock.calls.length

    await handler({
      logLine: "race test line",
      serverAddress: "10.0.0.2",
      serverPort: 27016,
    })

    expect(createMock.mock.calls.length).toBe(beforeCreate + 1)
    expect(processEventMock.mock.calls.length).toBe(beforeProcess + 1)
  })
})
