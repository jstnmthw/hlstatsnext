import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks
const startMock = vi.fn();
const stopMock = vi.fn();
const onMock = vi.fn();

vi.mock("@/services/ingress/udp-server", () => ({
  UdpServer: vi.fn().mockImplementation(() => ({
    start: startMock,
    stop: stopMock,
    on: onMock,
  })),
}));

// Mock DB
const serverCreateMock = vi.fn().mockResolvedValue({ serverId: 42 });
const dbMock = {
  getServerByAddress: vi.fn().mockResolvedValue(null),
  prisma: {
    server: {
      create: serverCreateMock,
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
} as unknown as import("@/database/client").DatabaseClient;

// Stub processor
const processorStub = {
  processEvent: vi.fn().mockResolvedValue(undefined),
} as unknown as EventProcessorService;

import { IngressService } from "@/services/ingress/ingress.service";
import { EventProcessorService } from "@/services/processor/processor.service";

describe("IngressService – dev skipAuth auto-registration", () => {
  let ingress: IngressService;

  beforeEach(() => {
    vi.clearAllMocks();
    ingress = new IngressService(27500, processorStub, dbMock, {
      skipAuth: true,
    });
  });

  it("creates a server row on first unseen ip:port and caches it", async () => {
    await ingress.start();

    // Retrieve registered log handler
    const call = onMock.mock.calls.find((c) => c[0] === "logReceived");
    expect(call).toBeDefined();
    const handler = call![1];

    const payload = {
      logLine:
        'L 01/01/2025 - 12:00:03: "RealGuy<3><STEAM_1:1:222><TERRORIST>" connected, address "8.8.8.8:27005"',
      serverAddress: "172.17.0.2",
      serverPort: 27015,
      timestamp: new Date(),
    };

    await handler(payload);

    expect(serverCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ address: "172.17.0.2", port: 27015 }),
      })
    );

    // Second packet should not call create again (cached)
    await handler(payload);
    expect(serverCreateMock).toHaveBeenCalledTimes(1);
  });
});
