import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UdpServer } from "../../src/services/ingress/udp-server";
import { EventEmitter } from "events";
import dgram from "dgram";

// Mock dgram
vi.mock("dgram");
const mockedDgram = vi.mocked(dgram);

class MockSocket extends EventEmitter {
  address = vi.fn().mockReturnValue({ address: "127.0.0.1", port: 12345 });
  bind = vi.fn((_port, _host, callback) => {
    this.emit("listening");
    if (callback) callback();
  });
  close = vi.fn((callback) => {
    this.emit("close");
    if (callback) callback();
  });
  send = vi.fn();
}

describe("UdpServer", () => {
  let server: UdpServer;
  let mockSocket: MockSocket;

  beforeEach(() => {
    mockSocket = new MockSocket();
    mockedDgram.createSocket.mockReturnValue(
      mockSocket as unknown as dgram.Socket
    );
    server = new UdpServer({ port: 12345 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Lifecycle", () => {
    it("should create a udp4 socket on start", async () => {
      await server.start();
      expect(mockedDgram.createSocket).toHaveBeenCalledWith("udp4");
    });

    it("should start listening on the specified port", async () => {
      await server.start();
      expect(mockSocket.bind).toHaveBeenCalledWith(12345, "0.0.0.0");
      expect(server.isListening()).toBe(true);
      expect(server.address()).toEqual({ address: "127.0.0.1", port: 12345 });
    });

    it("should stop the server", async () => {
      await server.start();
      await server.stop();
      expect(mockSocket.close).toHaveBeenCalled();
      expect(server.isListening()).toBe(false);
    });

    it("stop should resolve even if server is not running", async () => {
      expect(server.isListening()).toBe(false);
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe("Message Handling", () => {
    const remoteInfo = {
      address: "192.168.1.100",
      port: 27015,
      size: 50,
      family: "IPv4" as const,
    };

    beforeEach(async () => {
      await server.start();
    });

    it("should emit a logReceived event for a valid message", () => {
      const logSpy = vi.fn();
      server.on("logReceived", logSpy);
      const message = Buffer.from("L 01/01/2024 - 12:00:00: log message");

      mockSocket.emit("message", message, remoteInfo);

      expect(logSpy).toHaveBeenCalledWith({
        logLine: "L 01/01/2024 - 12:00:00: log message",
        serverAddress: "192.168.1.100",
        serverPort: 27015,
        timestamp: expect.any(Date),
      });
    });

    it("should emit a serverConnected event for a new server", () => {
      const connectSpy = vi.fn();
      server.on("serverConnected", connectSpy);
      const message = Buffer.from("first message");

      mockSocket.emit("message", message, remoteInfo);

      expect(connectSpy).toHaveBeenCalledWith({
        address: "192.168.1.100",
        port: 27015,
      });
      expect(server.getServerStats()).toHaveLength(1);
    });

    it("should not emit serverConnected for a known server", () => {
      const connectSpy = vi.fn();
      server.on("serverConnected", connectSpy);
      const message = Buffer.from("message");

      // First message
      mockSocket.emit("message", message, remoteInfo);
      // Second message
      mockSocket.emit("message", message, remoteInfo);

      expect(connectSpy).toHaveBeenCalledTimes(1);
      const stats = server.getServerStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]!.packetCount).toBe(2);
    });

    it("should reject oversized packets", () => {
      const logSpy = vi.fn();
      server.on("logReceived", logSpy);
      // Default max is 8192
      const oversizedMessage = Buffer.alloc(9000);
      mockSocket.emit("message", oversizedMessage, remoteInfo);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("should not emit logReceived for empty messages", () => {
      const logSpy = vi.fn();
      server.on("logReceived", logSpy);
      const emptyMessage = Buffer.from(" \r\n ");
      mockSocket.emit("message", emptyMessage, remoteInfo);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await server.start();
    });

    it("should emit an error event when the socket errors", () => {
      const errorSpy = vi.fn();
      const testError = new Error("Socket boom");
      server.on("error", errorSpy);

      mockSocket.emit("error", testError);

      expect(errorSpy).toHaveBeenCalledWith(testError);
    });
  });

  describe("Rate Limiting", () => {
    const remoteInfo = {
      address: "192.168.1.101",
      port: 27015,
      size: 50,
      family: "IPv4" as const,
    };

    beforeEach(async () => {
      await server.start();
    });

    it("should block requests exceeding the burst limit", () => {
      // Default burst is 50
      const logSpy = vi.fn();
      server.on("logReceived", logSpy);
      const message = Buffer.from("message");

      for (let i = 0; i < 60; i++) {
        mockSocket.emit("message", message, remoteInfo);
      }

      expect(logSpy).toHaveBeenCalledTimes(50);
    });
  });

  describe("Server Stats and Cleanup", () => {
    const server1 = {
      address: "192.168.1.1",
      port: 27015,
      size: 50,
      family: "IPv4" as const,
    };
    const server2 = {
      address: "192.168.1.2",
      port: 27016,
      size: 50,
      family: "IPv4" as const,
    };

    beforeEach(async () => {
      await server.start();
      vi.useFakeTimers(); // Use fake timers for time-based tests
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return stats for all connected servers", () => {
      mockSocket.emit("message", Buffer.from("msg"), server1);
      mockSocket.emit("message", Buffer.from("msg"), server2);
      expect(server.getServerStats()).toHaveLength(2);
    });

    it("should return only active servers", () => {
      mockSocket.emit("message", Buffer.from("msg"), server1);

      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      mockSocket.emit("message", Buffer.from("msg"), server2);

      const active = server.getActiveServers();
      expect(active).toHaveLength(1);
      expect(active[0]!.address).toBe(server2.address);
    });

    it("should clean up stale servers", () => {
      mockSocket.emit("message", Buffer.from("msg"), server1);

      vi.advanceTimersByTime(70 * 60 * 1000); // 70 minutes

      mockSocket.emit("message", Buffer.from("msg"), server2);

      server.cleanupStaleServers();

      const allServers = server.getServerStats();
      expect(allServers).toHaveLength(1);
      expect(allServers[0]!.address).toBe(server2.address);
    });
  });
});
