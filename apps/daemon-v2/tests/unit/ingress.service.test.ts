import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -----------------------------------------------------------------

// Mock UdpServer with basic start/stop/on methods.
const startMock = vi.fn().mockResolvedValue(undefined);
const stopMock = vi.fn().mockResolvedValue(undefined);
const onMock = vi.fn();

vi.mock("@/services/ingress/udp-server", () => {
  return {
    UdpServer: vi.fn().mockImplementation(() => ({
      start: startMock,
      stop: stopMock,
      on: onMock,
    })),
  };
});

// Mock DatabaseClient so no real DB hits occur.
vi.mock("@/database/client", () => {
  return {
    DatabaseClient: vi.fn().mockImplementation(() => ({
      getServerByAddress: vi.fn().mockResolvedValue({ serverId: 1 }),
    })),
  };
});

import { IngressService } from "../../src/services/ingress/ingress.service";

// Mock processor with a stubbed processEvent
const processEventMock = vi.fn().mockResolvedValue(undefined);
const processorStub = {
  processEvent: processEventMock,
} as unknown as import("../../src/services/processor/processor.service").EventProcessorService;

// ---------------------------------------------------------------------------

describe("IngressService", () => {
  let ingress: IngressService;

  beforeEach(() => {
    ingress = new IngressService(27500, processorStub);
    vi.clearAllMocks();
  });

  it("start() initialises underlying UDP server", async () => {
    await ingress.start();
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("stop() shuts down underlying UDP server", async () => {
    await ingress.start();
    await ingress.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("handles logReceived events and forwards to processor", async () => {
    await ingress.start();

    // Find the logReceived handler registered via onMock.
    const handler = onMock.mock.calls.find((c) => c[0] === "logReceived")[1];

    // Send first packet (authentication) – should not trigger processEvent
    await handler({
      logLine:
        'L 07/15/2024 - 22:33:10: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
      timestamp: new Date(),
    });

    // Second packet should be processed
    await handler({
      logLine:
        'L 07/15/2024 - 22:33:12: "Player<1><STEAM_1:0:111><CT>" connected, address "127.0.0.1:27005"',
      serverAddress: "127.0.0.1",
      serverPort: 27015,
      timestamp: new Date(),
    });

    expect(processEventMock).toHaveBeenCalledTimes(1);
  });
});
