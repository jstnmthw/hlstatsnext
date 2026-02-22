/**
 * Token Server Authenticator Tests
 */

import type { DatabaseClient } from "@/database/client"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { MockDatabaseClient } from "@/tests/mocks/database"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockEventBus } from "@/tests/mocks/event-bus"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockServerRecord } from "@/tests/mocks/server"
import { generateToken } from "@repo/crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ITokenRepository } from "../repositories"
import { TokenServerAuthenticator } from "./token-server-authenticator"

describe("TokenServerAuthenticator", () => {
  let authenticator: TokenServerAuthenticator
  let mockDatabase: MockDatabaseClient & DatabaseClient
  let mockTokenRepository: ITokenRepository
  let mockLogger: ILogger
  let mockEventBus: IEventBus

  const validToken = generateToken()

  const mockTokenEntity = {
    id: 1,
    tokenHash: validToken.hash,
    tokenPrefix: validToken.prefix,
    name: "Test Token",
    rconPassword: "encrypted_rcon_pwd",
    game: "cstrike",
    createdAt: new Date("2026-01-01"),
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdBy: "admin",
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-18T12:00:00Z"))

    mockDatabase = createMockDatabaseClient()
    mockLogger = createMockLogger()
    mockEventBus = createMockEventBus()

    mockTokenRepository = {
      findByHash: vi.fn(),
      updateLastUsed: vi.fn(),
      findById: vi.fn(),
    }

    authenticator = new TokenServerAuthenticator(
      mockDatabase,
      mockTokenRepository,
      mockLogger,
      mockEventBus,
      {
        tokenCacheTtlMs: 60_000,
        sourceCacheTtlMs: 300_000,
        rateLimiter: { maxAttempts: 3 },
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    authenticator.clearCaches()
  })

  describe("handleBeacon", () => {
    it("should authenticate with valid token and existing server", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({ kind: "authenticated", serverId: 42 })
      expect(mockTokenRepository.updateLastUsed).toHaveBeenCalledWith(1)

      // SERVER_AUTHENTICATED emitted for all successful authentications (not just auto-register)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "SERVER_AUTHENTICATED",
          serverId: 42,
        }),
      )
    })

    it("should auto-register new server with valid token and copy config defaults", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(null)
      vi.mocked(mockDatabase.prisma.server.create).mockResolvedValue(
        createMockServerRecord({ serverId: 100 }),
      )

      // Mock config defaults to be copied
      const mockDefaults = [
        { parameter: "Mod", value: "AMXX", description: "" },
        { parameter: "GameEngine", value: "1", description: "" },
      ]
      vi.mocked(mockDatabase.prisma.serverConfigDefault.findMany).mockResolvedValue(mockDefaults)
      vi.mocked(mockDatabase.prisma.serverConfig.createMany).mockResolvedValue({ count: 2 })

      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({
        kind: "auto_registered",
        serverId: 100,
        tokenId: 1,
      })

      expect(mockDatabase.prisma.server.create).toHaveBeenCalledWith({
        data: {
          address: "192.168.1.100",
          port: 27015,
          name: "192.168.1.100:27015",
          game: "cstrike",
          rconPassword: "encrypted_rcon_pwd",
          authTokenId: 1,
        },
        select: { serverId: true },
      })

      // Verify config defaults were copied to server_config
      expect(mockDatabase.prisma.serverConfigDefault.findMany).toHaveBeenCalled()
      expect(mockDatabase.prisma.serverConfig.createMany).toHaveBeenCalledWith({
        data: [
          { serverId: 100, parameter: "Mod", value: "AMXX" },
          { serverId: 100, parameter: "GameEngine", value: "1" },
        ],
        skipDuplicates: true,
      })

      expect(mockEventBus.emit).toHaveBeenCalled()
    })

    it("should reject invalid token format", async () => {
      const result = await authenticator.handleBeacon(
        "invalid_token",
        27015,
        "192.168.1.100",
        54321,
      )

      expect(result).toEqual({ kind: "unauthorized", reason: "invalid_format" })
      expect(mockTokenRepository.findByHash).not.toHaveBeenCalled()
    })

    it("should reject revoked token", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "revoked",
        tokenPrefix: validToken.prefix,
      })

      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({ kind: "unauthorized", reason: "revoked" })
    })

    it("should reject expired token", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "expired",
        tokenPrefix: validToken.prefix,
      })

      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({ kind: "unauthorized", reason: "expired" })
    })

    it("should reject unknown token", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "not_found",
      })

      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({ kind: "unauthorized", reason: "not_found" })
    })

    it("should rate limit after repeated failures", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "not_found",
      })

      // First 3 failures
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      // 4th attempt should be rate-limited
      const result = await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(result).toEqual({ kind: "unauthorized", reason: "rate_limited" })
    })

    it("should update address when server IP changes (e.g. Docker restart)", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      // Server exists with old Docker IP
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, address: "172.18.0.2", authTokenId: 1 }),
      )

      // Beacon arrives from new Docker IP after container restart
      const result = await authenticator.handleBeacon(validToken.raw, 27015, "172.18.0.5", 54321)

      expect(result).toEqual({ kind: "authenticated", serverId: 42 })
      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 42 },
        data: { address: "172.18.0.5" },
      })
    })

    it("should not update address when it has not changed", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, address: "192.168.1.100", authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      expect(mockDatabase.prisma.server.update).not.toHaveBeenCalled()
    })

    it("should find server by tokenId + port, not by address", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, address: "172.18.0.2", authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "172.18.0.5", 54321)

      // Verify lookup uses tokenId + port, NOT address + port
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledWith({
        where: { authTokenId: 1, port: 27015 },
        select: { serverId: true, address: true },
      })
    })
  })

  describe("lookupSource", () => {
    it("should return undefined for unknown source", () => {
      const result = authenticator.lookupSource("192.168.1.100", 54321)
      expect(result).toBeUndefined()
    })

    it("should return serverId for authenticated source", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      const result = authenticator.lookupSource("192.168.1.100", 54321)
      expect(result).toBe(42)
    })

    it("should return undefined after source cache expires", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      // Advance past source cache TTL
      vi.advanceTimersByTime(300_001)

      const result = authenticator.lookupSource("192.168.1.100", 54321)
      expect(result).toBeUndefined()
    })
  })

  describe("getAuthenticatedServerIds", () => {
    it("should return empty array when no servers authenticated", () => {
      expect(authenticator.getAuthenticatedServerIds()).toEqual([])
    })

    it("should return authenticated server IDs", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst)
        .mockResolvedValueOnce(createMockServerRecord({ serverId: 42, authTokenId: 1 }))
        .mockResolvedValueOnce(createMockServerRecord({ serverId: 43, authTokenId: 1 }))

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)
      await authenticator.handleBeacon(validToken.raw, 27016, "192.168.1.100", 54322)

      const ids = authenticator.getAuthenticatedServerIds()
      expect(ids).toContain(42)
      expect(ids).toContain(43)
    })

    it("should not include expired entries", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      // Advance past TTL
      vi.advanceTimersByTime(300_001)

      expect(authenticator.getAuthenticatedServerIds()).toEqual([])
    })
  })

  describe("token cache", () => {
    it("should use cached token on subsequent requests", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      // First request - hits repository
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)
      expect(mockTokenRepository.findByHash).toHaveBeenCalledTimes(1)

      // Second request - should use cache
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54322)
      expect(mockTokenRepository.findByHash).toHaveBeenCalledTimes(1) // Still 1
    })

    it("should refresh cache after TTL expires", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      // First request
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)
      expect(mockTokenRepository.findByHash).toHaveBeenCalledTimes(1)

      // Advance past token cache TTL
      vi.advanceTimersByTime(60_001)

      // Should query repository again
      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54322)
      expect(mockTokenRepository.findByHash).toHaveBeenCalledTimes(2)
    })
  })

  describe("clearCaches", () => {
    it("should clear all caches", async () => {
      vi.mocked(mockTokenRepository.findByHash).mockResolvedValue({
        kind: "valid",
        token: mockTokenEntity,
      })

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(
        createMockServerRecord({ serverId: 42, authTokenId: 1 }),
      )

      await authenticator.handleBeacon(validToken.raw, 27015, "192.168.1.100", 54321)

      authenticator.clearCaches()

      expect(authenticator.lookupSource("192.168.1.100", 54321)).toBeUndefined()
      expect(authenticator.getAuthenticatedServerIds()).toEqual([])
    })
  })
})
