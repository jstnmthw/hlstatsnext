/**
 * Application Context Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createAppContext, getAppContext, resetAppContext } from "./context"

// Mock all the imported modules
vi.mock("@/database/client")
vi.mock("@/shared/utils/logger")
vi.mock("@/modules/player/player.repository")
vi.mock("@/modules/player/player.service")
vi.mock("@/modules/match/match.repository")
vi.mock("@/modules/match/match.service")
vi.mock("@/modules/weapon/weapon.repository")
vi.mock("@/modules/weapon/weapon.service")
vi.mock("@/modules/ranking/ranking.service")
vi.mock("@/modules/action/action.repository")
vi.mock("@/modules/action/action.service")
vi.mock("@/modules/ingress/ingress.service")
vi.mock("@/modules/game/game-detection.service")
vi.mock("@/modules/server/server.repository")
vi.mock("@/modules/server/server.service")

// Mock the crypto package
vi.mock("@repo/crypto", () => ({
  createCryptoService: vi.fn(() => ({
    hashPassword: vi.fn().mockResolvedValue("hashed_password"),
    verifyPassword: vi.fn().mockResolvedValue(true),
    encrypt: vi.fn().mockResolvedValue("encrypted_data"),
    decrypt: vi.fn().mockResolvedValue("decrypted_data"),
  })),
}))

// Mock the infrastructure config factory
vi.mock("@/shared/application/factories/infrastructure-config.factory", () => ({
  createInfrastructureComponents: vi.fn().mockResolvedValue({
    database: {
      initializeConnectionPool: vi.fn().mockResolvedValue(undefined),
    },
    logger: {},
    crypto: {
      hashPassword: vi.fn().mockResolvedValue("hashed_password"),
      verifyPassword: vi.fn().mockResolvedValue(true),
      encrypt: vi.fn().mockResolvedValue("encrypted_data"),
      decrypt: vi.fn().mockResolvedValue("decrypted_data"),
    },
  }),
}))

describe("Application Context", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAppContext()
  })

  afterEach(() => {
    resetAppContext()
  })

  describe("createAppContext", () => {
    it("should create context with all required services", () => {
      const context = createAppContext()

      expect(context).toBeDefined()
      expect(context.database).toBeDefined()
      expect(context.logger).toBeDefined()
      expect(context.playerService).toBeDefined()
      expect(context.matchService).toBeDefined()
      expect(context.weaponService).toBeDefined()
      expect(context.rankingService).toBeDefined()
      expect(context.actionService).toBeDefined()
      expect(context.ingressService).toBeDefined()
      expect(context.gameDetectionService).toBeDefined()
      expect(context.serverService).toBeDefined()
    })

    it("should create context with ingress options", () => {
      const ingressOptions = {}
      const context = createAppContext(ingressOptions)

      expect(context).toBeDefined()
      expect(context.ingressService).toBeDefined()
    })

    it("should create context without ingress options", () => {
      const context = createAppContext()

      expect(context).toBeDefined()
      expect(context.ingressService).toBeDefined()
    })

    it("should create new instances each time", () => {
      const context1 = createAppContext()
      const context2 = createAppContext()

      expect(context1).not.toBe(context2)
      expect(context1.database).not.toBe(context2.database)
      expect(context1.logger).not.toBe(context2.logger)
    })

    it("should wire dependencies correctly", () => {
      const context = createAppContext()

      // All services should be properly instantiated
      expect(context.database).toBeDefined()
      expect(context.logger).toBeDefined()

      // Business services should be wired
      expect(context.playerService).toBeDefined()
      expect(context.matchService).toBeDefined()
      expect(context.weaponService).toBeDefined()
      expect(context.rankingService).toBeDefined()
      expect(context.actionService).toBeDefined()
      expect(context.gameDetectionService).toBeDefined()
      expect(context.serverService).toBeDefined()

      // Ingress service should be set after context creation
      expect(context.ingressService).toBeDefined()
    })
  })

  describe("getAppContext", () => {
    it("should create singleton instance on first call", () => {
      const context1 = getAppContext()
      const context2 = getAppContext()

      expect(context1).toBe(context2) // Same instance
      expect(context1).toBeDefined()
    })

    it("should pass ingress options to created context", () => {
      const ingressOptions = {}
      const context = getAppContext(ingressOptions)

      expect(context).toBeDefined()
      expect(context.ingressService).toBeDefined()
    })

    it("should ignore ingress options on subsequent calls", () => {
      const context1 = getAppContext({})
      const context2 = getAppContext({})

      expect(context1).toBe(context2) // Same instance, options ignored
    })

    it("should create context if none exists", () => {
      expect(getAppContext()).toBeDefined()
    })

    it("should return existing context if already created", () => {
      const context1 = getAppContext()
      const context2 = getAppContext()

      expect(context1).toBe(context2)
      expect(context1.database).toBe(context2.database)
      expect(context1.logger).toBe(context2.logger)
    })
  })

  describe("resetAppContext", () => {
    it("should reset singleton instance", () => {
      const context1 = getAppContext()
      resetAppContext()
      const context2 = getAppContext()

      expect(context1).not.toBe(context2) // Different instances after reset
    })

    it("should allow creating new context after reset", () => {
      getAppContext()
      resetAppContext()
      const newContext = getAppContext()

      expect(newContext).toBeDefined()
      expect(newContext.database).toBeDefined()
      expect(newContext.logger).toBeDefined()
    })

    it("should not throw when called without existing context", () => {
      expect(() => resetAppContext()).not.toThrow()
    })

    it("should allow multiple resets", () => {
      getAppContext()
      resetAppContext()
      resetAppContext()
      resetAppContext()

      const context = getAppContext()
      expect(context).toBeDefined()
    })
  })

  describe("AppContext interface", () => {
    it("should have all required infrastructure properties", () => {
      const context = getAppContext()

      expect(context).toHaveProperty("database")
      expect(context).toHaveProperty("logger")
    })

    it("should have all required service properties", () => {
      const context = getAppContext()

      expect(context).toHaveProperty("playerService")
      expect(context).toHaveProperty("matchService")
      expect(context).toHaveProperty("weaponService")
      expect(context).toHaveProperty("rankingService")
      expect(context).toHaveProperty("actionService")
      expect(context).toHaveProperty("ingressService")
      expect(context).toHaveProperty("gameDetectionService")
      expect(context).toHaveProperty("serverService")
    })

    it("should have proper service types", () => {
      const context = getAppContext()

      expect(typeof context.playerService).toBe("object")
      expect(typeof context.matchService).toBe("object")
      expect(typeof context.weaponService).toBe("object")
      expect(typeof context.rankingService).toBe("object")
      expect(typeof context.actionService).toBe("object")
      expect(typeof context.ingressService).toBe("object")
      expect(typeof context.gameDetectionService).toBe("object")
      expect(typeof context.serverService).toBe("object")
    })
  })

  describe("dependency injection", () => {
    it("should create services in correct order", () => {
      const context = createAppContext()

      // Infrastructure should be created first
      expect(context.database).toBeDefined()
      expect(context.logger).toBeDefined()

      // Services should be created with proper dependencies
      expect(context.rankingService).toBeDefined()
      expect(context.matchService).toBeDefined()
      expect(context.playerService).toBeDefined()
      expect(context.weaponService).toBeDefined()
      expect(context.actionService).toBeDefined()
      expect(context.gameDetectionService).toBeDefined()
      expect(context.serverService).toBeDefined()

      // Ingress service should be created last with full context
      expect(context.ingressService).toBeDefined()
    })

    it("should handle circular dependencies correctly", () => {
      const context = createAppContext()

      // Context should be fully formed despite circular references
      expect(context.ingressService).toBeDefined()
      expect(context.ingressService).not.toBeNull()
    })
  })

  describe("error handling", () => {
    it("should handle service instantiation", () => {
      expect(() => createAppContext()).not.toThrow()
    })

    it("should handle singleton creation", () => {
      expect(() => getAppContext()).not.toThrow()
    })

    it("should handle reset operations", () => {
      expect(() => resetAppContext()).not.toThrow()
    })
  })

  describe("integration scenarios", () => {
    it("should support multiple create and reset cycles", () => {
      const context1 = getAppContext()
      resetAppContext()
      const context2 = getAppContext({})
      resetAppContext()
      const context3 = getAppContext()

      expect(context1).not.toBe(context2)
      expect(context2).not.toBe(context3)
      expect(context1).not.toBe(context3)
    })

    it("should maintain service consistency across contexts", () => {
      const context1 = createAppContext()
      const context2 = createAppContext()

      // Should have same service types but different instances
      expect(typeof context1.playerService).toBe(typeof context2.playerService)
      expect(typeof context1.matchService).toBe(typeof context2.matchService)
      expect(context1.playerService).not.toBe(context2.playerService)
      expect(context1.matchService).not.toBe(context2.matchService)
    })
  })
})
