/**
 * Queue Manager for Event Processing
 *
 * Manages Redis-based queues for distributing game events
 * to processing workers with proper priority and retry handling.
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import type { GameEvent } from "@/types/common/events";

export interface QueueManagerOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    highPriority: string;
    normal: string;
    lowPriority: string;
  };
  concurrency?: {
    highPriority: number;
    normal: number;
    lowPriority: number;
  };
}

export interface JobData {
  event: GameEvent;
  priority: "high" | "normal" | "low";
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export class QueueManager {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private readonly options: Required<QueueManagerOptions>;

  constructor(options: QueueManagerOptions) {
    this.options = {
      concurrency: {
        highPriority: 10,
        normal: 5,
        lowPriority: 2,
      },
      ...options,
    };

    this.redis = new Redis({
      host: this.options.redis.host,
      port: this.options.redis.port,
      password: this.options.redis.password,
      db: this.options.redis.db || 0,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test Redis connection
      await this.redis.ping();
      console.log("Connected to Redis for queue management");

      // Initialize queues
      for (const [priority, queueName] of Object.entries(this.options.queues)) {
        await this.createQueue(
          queueName,
          priority as keyof typeof this.options.concurrency,
        );
      }

      console.log("Queue manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize queue manager:", error);
      throw error;
    }
  }

  private async createQueue(
    queueName: string,
    priority: keyof typeof this.options.concurrency,
  ): Promise<void> {
    // Create queue
    const queue = new Queue(queueName, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    this.queues.set(queueName, queue);

    // Create worker
    const worker = new Worker(
      queueName,
      async (job) => {
        return this.processJob(job.data as JobData);
      },
      {
        connection: this.redis,
        concurrency: this.options.concurrency[priority],
        limiter: {
          max: this.options.concurrency[priority] * 2,
          duration: 1000, // per second
        },
      },
    );

    // Worker event listeners
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
    });

    this.workers.set(queueName, worker);

    // Queue events for monitoring
    const queueEvents = new QueueEvents(queueName, { connection: this.redis });

    queueEvents.on("waiting", ({ jobId }) => {
      console.log(`Job ${jobId} is waiting in ${queueName}`);
    });

    queueEvents.on("active", ({ jobId }) => {
      console.log(`Job ${jobId} is active in ${queueName}`);
    });

    this.queueEvents.set(queueName, queueEvents);
  }

  async enqueueEvent(
    event: GameEvent,
    priority: "high" | "normal" | "low" = "normal",
  ): Promise<void> {
    const queueName = this.getQueueName(priority);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobData: JobData = {
      event,
      priority,
      metadata: {
        enqueuedAt: new Date().toISOString(),
        serverId: event.serverId,
        eventType: event.eventType,
      },
    };

    // Set job priority (higher number = higher priority)
    const jobPriority = this.getJobPriority(priority);

    await queue.add(`process-${event.eventType}`, jobData, {
      priority: jobPriority,
      delay: priority === "low" ? 1000 : 0, // Delay low priority jobs
    });
  }

  private async processJob(jobData: JobData): Promise<void> {
    const { event, priority } = jobData;

    try {
      // TODO: Actually process the event through handlers
      // For now, just simulate processing
      console.log(
        `Processing ${event.eventType} event (priority: ${priority}) from server ${event.serverId}`,
      );

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    } catch (error) {
      console.error(`Error processing event ${event.eventType}:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private getQueueName(priority: "high" | "normal" | "low"): string {
    switch (priority) {
      case "high":
        return this.options.queues.highPriority;
      case "normal":
        return this.options.queues.normal;
      case "low":
        return this.options.queues.lowPriority;
      default:
        return this.options.queues.normal;
    }
  }

  private getJobPriority(priority: "high" | "normal" | "low"): number {
    switch (priority) {
      case "high":
        return 100;
      case "normal":
        return 50;
      case "low":
        return 10;
      default:
        return 50;
    }
  }

  async getQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [name, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    }

    return stats;
  }

  async shutdown(): Promise<void> {
    console.log("Shutting down queue manager...");

    // Close queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    // Close workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close Redis connection
    await this.redis.quit();

    console.log("Queue manager shutdown complete");
  }
}
