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

// Mock DatabaseClient
vi.mock("@/database/client", () => {
  return {
    DatabaseClient: vi.fn().mockImplementation(() => ({
      prisma: {
        server: {
          create: vi.fn().mockResolvedValue({ serverId: 42 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      client: undefined,
    })),
  }
})

// Mock ServerService
vi.mock("@/services/server/server.service", () => {
  return {
    ServerService: vi.fn().mockImplementation(() => ({
      getServerByAddress: vi.fn().mockResolvedValue({ serverId: 1 }),
      db: undefined,
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
import { ServerService } from "../../src/services/server/server.service"
import { EventProcessorService } from "@/services/processor/processor.service"
import type { MockDatabaseClient, MockServerService } from "../types/test-mocks"

const MockedDatabaseClient = vi.mocked(DatabaseClient)
const MockedServerService = vi.mocked(ServerService)

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
    // Create a custom mock for this test
    const mockServerService: MockServerService = {
      getServerByAddress: vi.fn().mockResolvedValue(null),
      getGameByServerId: vi.fn().mockResolvedValue(null),
      db: {} as MockDatabaseClient,
    }

    // Create a new ingress service with the custom mock
    const customIngress = new IngressService(27500, processorStub)
    // Replace the serverService with our mock - this is necessary for testing internal behavior
    Object.defineProperty(customIngress, "serverService", {
      value: mockServerService,
      writable: true,
    })

    await customIngress.start()

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

  let ingress: IngressService

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock DatabaseClient for skipAuth tests
    MockedDatabaseClient.mockImplementation(
      () =>
        ({
          prisma: {
            server: {
              create: serverCreateMock,
              findFirst: vi.fn().mockResolvedValue(null),
            },
            playerUniqueId: { findUnique: vi.fn() },
            player: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
            weapon: { findFirst: vi.fn() },
            eventConnect: { create: vi.fn() },
            eventDisconnect: { create: vi.fn() },
            eventFrag: { create: vi.fn() },
            eventSuicide: { create: vi.fn() },
            eventTeamkill: { create: vi.fn() },
            eventChat: { create: vi.fn() },
            eventEntry: { findMany: vi.fn() },
          },
          testConnection: vi.fn(),
          transaction: vi.fn(),
          disconnect: vi.fn(),
          client: undefined,
        }) as unknown as DatabaseClient,
    )

    // Mock ServerService for skipAuth tests
    MockedServerService.mockImplementation(
      () =>
        ({
          getServerByAddress: vi.fn().mockResolvedValue(null),
          db: undefined,
        }) as unknown as ServerService,
    )

    ingress = new IngressService(27500, processorStub, undefined, {
      skipAuth: true,
    })
  })

  it("creates a server row on first unseen ip:port and caches it", async () => {
    await ingress.start()

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    await handler({
      logLine: "any log line",
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    expect(serverCreateMock).toHaveBeenCalledWith({
      data: {
        address: "127.0.0.1",
        port: 27015,
        name: "DEV 127.0.0.1:27015",
        game: "cstrike",
      },
      select: { serverId: true },
    })
  })
})

/**
 * Dev environment behaviour - skipAuth immediate processing & race condition
 */
describe("IngressService - skipAuth immediate processing & race condition", () => {
  let ingress: IngressService

  beforeEach(() => {
    vi.clearAllMocks()
    ingress = new IngressService(27500, processorStub, undefined, {
      skipAuth: true,
    })
  })

  it("processes first packet immediately when skipAuth=true", async () => {
    // Mock ServerService to return null initially
    MockedServerService.mockImplementation(
      () =>
        ({
          getServerByAddress: vi.fn().mockResolvedValue(null),
          db: undefined,
        }) as unknown as ServerService,
    )

    // Mock DatabaseClient for server creation
    MockedDatabaseClient.mockImplementation(
      () =>
        ({
          prisma: {
            server: {
              create: vi.fn().mockResolvedValue({ serverId: 42 }),
              findFirst: vi.fn(),
            },
            playerUniqueId: { findUnique: vi.fn() },
            player: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
            weapon: { findFirst: vi.fn() },
            eventConnect: { create: vi.fn() },
            eventDisconnect: { create: vi.fn() },
            eventFrag: { create: vi.fn() },
            eventSuicide: { create: vi.fn() },
            eventTeamkill: { create: vi.fn() },
            eventChat: { create: vi.fn() },
            eventEntry: { findMany: vi.fn() },
          },
          testConnection: vi.fn(),
          transaction: vi.fn(),
          disconnect: vi.fn(),
          client: undefined,
        }) as unknown as DatabaseClient,
    )

    await ingress.start()

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    await handler({
      logLine: 'L 07/15/2024 - 22:33:10: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    expect(processEventMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to existing server row when unique constraint race occurs", async () => {
    // Create a custom ingress service with mocked dependencies
    const getServerByAddressMock = vi
      .fn()
      .mockResolvedValueOnce(null) // First call returns null
      .mockResolvedValueOnce({ serverId: 42 }) // Second call (after race) returns server

    const createMock = vi.fn().mockRejectedValue({ code: "P2002" })

    const mockDb = {
      prisma: {
        server: {
          create: createMock,
          findFirst: vi.fn(),
        },
        playerUniqueId: { findUnique: vi.fn() },
        player: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
        weapon: { findFirst: vi.fn() },
        eventConnect: { create: vi.fn() },
        eventDisconnect: { create: vi.fn() },
        eventFrag: { create: vi.fn() },
        eventSuicide: { create: vi.fn() },
        eventTeamkill: { create: vi.fn() },
        eventChat: { create: vi.fn() },
        eventEntry: { findMany: vi.fn() },
      },
      testConnection: vi.fn(),
      transaction: vi.fn(),
      disconnect: vi.fn(),
      client: undefined,
    } as unknown as DatabaseClient

    const customIngress = new IngressService(27500, processorStub, mockDb, {
      skipAuth: true,
    })

    // Replace the serverService with our mock
    const mockServerService = {
      getServerByAddress: getServerByAddressMock,
      db: undefined,
    } as unknown as ServerService

    Object.defineProperty(customIngress, "serverService", {
      value: mockServerService,
      writable: true,
    })

    await customIngress.start()

    const call = onMock.mock.calls.find((c) => c[0] === "logReceived")
    expect(call).toBeDefined()
    const handler = call![1]

    await handler({
      logLine: 'L 07/15/2024 - 22:33:10: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
    })

    expect(getServerByAddressMock).toHaveBeenCalledTimes(2)
    expect(processEventMock).toHaveBeenCalledTimes(1)
  })
})
