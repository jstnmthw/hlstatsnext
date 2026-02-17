/**
 * Daemon Lifecycle E2E Tests
 *
 * Tests application context creation, service connectivity, and
 * graceful shutdown with real infrastructure (MySQL, RabbitMQ, Garnet).
 */

import { createAppContext, initializeQueueInfrastructure, type AppContext } from "@/context"
import { DatabaseClient } from "@/database/client"
import { afterEach, describe, expect, it } from "vitest"
import { getTestDb } from "../integration/helpers/test-db"

describe("Daemon Lifecycle (e2e)", () => {
  let context: AppContext | null = null

  afterEach(() => {
    context = null
  })

  describe("app context creation", () => {
    it("should create a full application context", () => {
      context = createAppContext({ port: 27500, host: "127.0.0.1" })

      expect(context).toBeDefined()
      expect(context.database).toBeInstanceOf(DatabaseClient)
      expect(context.logger).toBeDefined()
      expect(context.eventBus).toBeDefined()
      expect(context.playerService).toBeDefined()
      expect(context.matchService).toBeDefined()
      expect(context.weaponService).toBeDefined()
      expect(context.rankingService).toBeDefined()
      expect(context.actionService).toBeDefined()
      expect(context.ingressService).toBeDefined()
      expect(context.serverService).toBeDefined()
      expect(context.sessionService).toBeDefined()
    })

    it("should have module registry with event handlers", () => {
      context = createAppContext()

      expect(context.moduleRegistry).toBeDefined()
      expect(context.playerEventHandler).toBeDefined()
      expect(context.weaponEventHandler).toBeDefined()
      expect(context.matchEventHandler).toBeDefined()
      expect(context.actionEventHandler).toBeDefined()
      expect(context.serverEventHandler).toBeDefined()
    })
  })

  describe("database connectivity", () => {
    it("should connect to the test database", async () => {
      const db = getTestDb()
      const result = await db.$queryRaw`SELECT 1 as connected`
      expect(result).toBeDefined()
    })

    it("should read seed data from the database", async () => {
      const db = getTestDb()

      const games = await db.game.findMany()
      expect(games.length).toBeGreaterThanOrEqual(2) // cstrike, csgo seeded

      const countries = await db.country.findMany()
      expect(countries.length).toBeGreaterThanOrEqual(1) // US seeded
    })
  })

  describe("queue module", () => {
    it("should create a queue module when RABBITMQ_URL is set", () => {
      context = createAppContext()

      // Queue module is created (but not yet initialized/connected)
      expect(context.queueModule).toBeDefined()
    })

    it("should initialize queue infrastructure and connect to RabbitMQ", async () => {
      context = createAppContext()

      if (!context.queueModule) {
        // Skip if no queue module (RabbitMQ URL not configured)
        return
      }

      // Initialize connects to RabbitMQ and sets up topology
      await initializeQueueInfrastructure(context)

      // After initialization, publisher should be set
      expect(context.eventPublisher).toBeDefined()

      // Clean up: shutdown queue
      if (context.queueModule) {
        await context.queueModule.shutdown()
      }
    })
  })
})
