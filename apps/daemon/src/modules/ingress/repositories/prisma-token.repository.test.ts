/**
 * Prisma Token Repository Tests
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { MockDatabaseClient } from "@/tests/mocks/database"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PrismaTokenRepository } from "./prisma-token.repository"

describe("PrismaTokenRepository", () => {
  let repository: PrismaTokenRepository
  let mockDatabase: MockDatabaseClient & DatabaseClient
  let mockLogger: ILogger

  const mockTokenRecord = {
    id: 1,
    tokenHash: "abc123hash",
    tokenPrefix: "hlxn_K7gNU3sd",
    name: "Test Token",
    rconPassword: "encrypted_password",
    game: "cstrike",
    createdAt: new Date("2026-01-01"),
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdBy: "admin",
  }

  beforeEach(() => {
    mockDatabase = createMockDatabaseClient()
    mockLogger = createMockLogger()
    repository = new PrismaTokenRepository(mockDatabase, mockLogger)
  })

  describe("findByHash", () => {
    it("should return valid result for active token", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(mockTokenRecord)

      const result = await repository.findByHash("abc123hash")

      expect(result.kind).toBe("valid")
      if (result.kind === "valid") {
        expect(result.token.id).toBe(1)
        expect(result.token.tokenPrefix).toBe("hlxn_K7gNU3sd")
        expect(result.token.game).toBe("cstrike")
      }
    })

    it("should return not_found when token does not exist", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(null)

      const result = await repository.findByHash("nonexistent")

      expect(result).toEqual({ kind: "not_found" })
    })

    it("should return revoked when token is revoked", async () => {
      const revokedToken = {
        ...mockTokenRecord,
        revokedAt: new Date("2026-01-15"),
      }
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(revokedToken)

      const result = await repository.findByHash("abc123hash")

      expect(result).toEqual({ kind: "revoked", tokenPrefix: "hlxn_K7gNU3sd" })
    })

    it("should return expired when token is past expiry", async () => {
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: new Date("2026-01-01"), // In the past
      }
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(expiredToken)

      const result = await repository.findByHash("abc123hash")

      expect(result).toEqual({ kind: "expired", tokenPrefix: "hlxn_K7gNU3sd" })
    })

    it("should return valid when token has future expiry", async () => {
      const futureToken = {
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
      }
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(futureToken)

      const result = await repository.findByHash("abc123hash")

      expect(result.kind).toBe("valid")
    })

    it("should throw on database error", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockRejectedValueOnce(
        new Error("DB connection failed"),
      )

      await expect(repository.findByHash("abc123hash")).rejects.toThrow("Token lookup failed")
    })
  })

  describe("updateLastUsed", () => {
    it("should update lastUsedAt on first call", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValueOnce(mockTokenRecord)

      await repository.updateLastUsed(1)

      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastUsedAt: expect.any(Date) },
      })
    })

    it("should debounce rapid updates (skip if within 5 minutes)", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValue(mockTokenRecord)

      // First call - should update
      await repository.updateLastUsed(1)

      // Second call immediately - should be debounced
      await repository.updateLastUsed(1)

      // Should only have been called once
      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledTimes(1)
    })

    it("should allow updates for different tokens", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValue(mockTokenRecord)

      await repository.updateLastUsed(1)
      await repository.updateLastUsed(2)

      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledTimes(2)
    })

    it("should not throw on update failure (non-fatal)", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockRejectedValueOnce(new Error("DB error"))

      // Should not throw
      await expect(repository.updateLastUsed(1)).resolves.toBeUndefined()

      // Should have logged warning
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe("findById", () => {
    it("should return token entity when found", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(mockTokenRecord)

      const result = await repository.findById(1)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(1)
      expect(result?.name).toBe("Test Token")
    })

    it("should return null when not found", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockResolvedValueOnce(null)

      const result = await repository.findById(999)

      expect(result).toBeNull()
    })

    it("should throw on database error", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.findUnique).mockRejectedValueOnce(
        new Error("DB error"),
      )

      await expect(repository.findById(1)).rejects.toThrow("Token lookup by ID failed")
    })
  })

  describe("clearDebounceState", () => {
    it("should clear debounce for specific token", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValue(mockTokenRecord)

      await repository.updateLastUsed(1)
      repository.clearDebounceState(1)
      await repository.updateLastUsed(1)

      // Should have called update twice since state was cleared
      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledTimes(2)
    })

    it("should clear all debounce state when no token specified", async () => {
      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValue(mockTokenRecord)

      await repository.updateLastUsed(1)
      await repository.updateLastUsed(2)
      repository.clearDebounceState()
      await repository.updateLastUsed(1)
      await repository.updateLastUsed(2)

      // 2 initial + 2 after clear
      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledTimes(4)
    })
  })

  describe("custom debounce config", () => {
    it("should respect custom debounce interval", async () => {
      // Create repository with very short debounce (1ms)
      const customRepo = new PrismaTokenRepository(mockDatabase, mockLogger, {
        lastUsedDebounceMsDefault: 1,
      })

      vi.mocked(mockDatabase.prisma.serverToken.update).mockResolvedValue(mockTokenRecord)

      await customRepo.updateLastUsed(1)

      // Wait just over 1ms
      await new Promise((resolve) => setTimeout(resolve, 5))

      await customRepo.updateLastUsed(1)

      // Both should have been allowed
      expect(mockDatabase.prisma.serverToken.update).toHaveBeenCalledTimes(2)
    })
  })
})
