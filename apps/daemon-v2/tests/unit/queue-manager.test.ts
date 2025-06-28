import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { QueueManager } from "../../src/services/ingress/queue-manager";
import type { QueueManagerOptions } from "../../src/services/ingress/queue-manager";
import { GameEvent, EventType } from "../../src/types/common/events";
import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";

// Mock dependencies
vi.mock("bullmq");
vi.mock("ioredis");

const MockedRedis = vi.mocked(Redis);
const MockedQueue = vi.mocked(Queue);
const MockedWorker = vi.mocked(Worker);
const MockedQueueEvents = vi.mocked(QueueEvents);

describe("QueueManager", () => {
  const mockOptions: QueueManagerOptions = {
    redis: { host: "localhost", port: 6379 },
    queues: {
      highPriority: "queue-high",
      normal: "queue-normal",
      lowPriority: "queue-low",
    },
    concurrency: {
      highPriority: 1,
      normal: 1,
      lowPriority: 1,
    },
  };

  let queueManager: QueueManager;
  let mockRedisInstance: Mocked<Redis>;
  let mockQueueInstance: Mocked<Queue>;
  let mockWorkerInstance: Mocked<Worker>;
  let mockQueueEventsInstance: Mocked<QueueEvents>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-create mock instances before each test to prevent state leakage
    mockRedisInstance = {
      ping: vi.fn().mockResolvedValue("PONG"),
      quit: vi.fn().mockResolvedValue("OK"),
    } as unknown as Mocked<Redis>;

    mockQueueInstance = {
      add: vi.fn(),
      close: vi.fn(),
      getWaiting: vi.fn().mockResolvedValue([]),
      getActive: vi.fn().mockResolvedValue([]),
      getCompleted: vi.fn().mockResolvedValue([]),
      getFailed: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<Queue>;

    mockWorkerInstance = {
      close: vi.fn(),
      on: vi.fn(),
    } as unknown as Mocked<Worker>;

    mockQueueEventsInstance = {
      close: vi.fn(),
      on: vi.fn(),
    } as unknown as Mocked<QueueEvents>;

    MockedRedis.mockReturnValue(mockRedisInstance);
    MockedQueue.mockReturnValue(mockQueueInstance);
    MockedWorker.mockReturnValue(mockWorkerInstance);
    MockedQueueEvents.mockReturnValue(mockQueueEventsInstance);
  });

  describe("Constructor and Initialization", () => {
    it("should create a Redis instance with correct options", () => {
      new QueueManager(mockOptions);
      expect(MockedRedis).toHaveBeenCalledWith({
        host: "localhost",
        port: 6379,
        db: 0,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        password: undefined,
      });
    });

    it("should initialize successfully", async () => {
      queueManager = new QueueManager(mockOptions);
      await queueManager.initialize();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(MockedQueue).toHaveBeenCalledTimes(3);
      expect(MockedWorker).toHaveBeenCalledTimes(3);
      expect(MockedQueueEvents).toHaveBeenCalledTimes(3);
    });

    it("should throw an error if Redis connection fails", async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error("Redis down"));
      queueManager = new QueueManager(mockOptions);
      await expect(queueManager.initialize()).rejects.toThrow("Redis down");
    });
  });

  describe("Event Enqueueing", () => {
    const mockEvent: GameEvent = {
      serverId: 1,
      eventType: EventType.PLAYER_CONNECT,
      data: {
        playerId: 123,
        steamId: "STEAM_0:0:12345",
        playerName: "test-player",
        ipAddress: "127.0.0.1",
      },
      timestamp: new Date(),
    };

    beforeEach(async () => {
      queueManager = new QueueManager(mockOptions);
      await queueManager.initialize();
    });

    it("should enqueue a high-priority event to the correct queue", async () => {
      await queueManager.enqueueEvent(mockEvent, "high");
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        "process-PLAYER_CONNECT",
        expect.any(Object),
        { priority: 100, delay: 0 }
      );
      // Ensure the correct queue was used
      const highPriorityQueueName = mockOptions.queues.highPriority;
      expect(MockedQueue).toHaveBeenCalledWith(
        highPriorityQueueName,
        expect.any(Object)
      );
    });

    it("should enqueue a normal-priority event by default", async () => {
      await queueManager.enqueueEvent(mockEvent);
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        "process-PLAYER_CONNECT",
        expect.any(Object),
        { priority: 50, delay: 0 }
      );
    });

    it("should enqueue a low-priority event with a delay", async () => {
      await queueManager.enqueueEvent(mockEvent, "low");
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        "process-PLAYER_CONNECT",
        expect.any(Object),
        { priority: 10, delay: 1000 }
      );
    });

    it("should throw if queue is not found", async () => {
      // "get" on the internal map returns undefined
      vi.spyOn(queueManager["queues"], "get").mockReturnValue(undefined);
      await expect(queueManager.enqueueEvent(mockEvent)).rejects.toThrow(
        `Queue ${mockOptions.queues.normal} not found`
      );
    });
  });

  describe("Queue Stats", () => {
    it("should return stats for all queues", async () => {
      queueManager = new QueueManager(mockOptions);
      await queueManager.initialize();

      mockQueueInstance.getWaiting.mockResolvedValue([1, 2]);
      mockQueueInstance.getActive.mockResolvedValue([3]);
      mockQueueInstance.getCompleted.mockResolvedValue([]);
      mockQueueInstance.getFailed.mockResolvedValue([4, 5, 6]);

      const stats = await queueManager.getQueueStats();

      expect(stats).toEqual({
        "queue-high": { waiting: 2, active: 1, completed: 0, failed: 3 },
        "queue-normal": { waiting: 2, active: 1, completed: 0, failed: 3 },
        "queue-low": { waiting: 2, active: 1, completed: 0, failed: 3 },
      });
    });
  });

  describe("Shutdown", () => {
    it("should close all queues, workers, and the redis connection", async () => {
      queueManager = new QueueManager(mockOptions);
      await queueManager.initialize();
      await queueManager.shutdown();

      expect(mockQueueInstance.close).toHaveBeenCalledTimes(3);
      expect(mockWorkerInstance.close).toHaveBeenCalledTimes(3);
      expect(mockQueueEventsInstance.close).toHaveBeenCalledTimes(3);
      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1);
    });
  });
});
