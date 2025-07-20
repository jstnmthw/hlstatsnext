/**
 * WeaponRepository Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WeaponRepository } from './weapon.repository'
import { createMockLogger } from '../../test-support/mocks/logger'
import { createMockDatabaseClient } from '../../test-support/mocks/database'
import type { DatabaseClient } from '@/database/client'

describe('WeaponRepository', () => {
  let weaponRepository: WeaponRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    weaponRepository = new WeaponRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
  })

  describe('Repository instantiation', () => {
    it('should create repository instance', () => {
      expect(weaponRepository).toBeDefined()
      expect(weaponRepository).toBeInstanceOf(WeaponRepository)
    })

    it('should have required methods', () => {
      expect(weaponRepository.updateWeaponStats).toBeDefined()
      expect(weaponRepository.findWeaponByCode).toBeDefined()
      expect(typeof weaponRepository.updateWeaponStats).toBe('function')
      expect(typeof weaponRepository.findWeaponByCode).toBe('function')
    })
  })

  describe('updateWeaponStats', () => {
    it('should upsert weapon statistics', async () => {
      const weaponCode = 'ak47'
      const updates = { shots: { increment: 5 }, hits: { increment: 3 } }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({
        weaponId: 1,
        game: 'csgo',
        code: weaponCode,
        name: weaponCode,
        modifier: 1,
        kills: 0,
        headshots: 0,
      })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: {
          code: weaponCode,
          game: 'csgo',
          name: weaponCode,
          modifier: 1,
          kills: 0,
          headshots: 0,
          shots: { increment: 5 },
          hits: { increment: 3 },
        },
        update: updates,
      })
    })

    it('should handle new weapon creation', async () => {
      const weaponCode = 'new_weapon'
      const updates = { shots: { increment: 1 } }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({
        weaponId: 2,
        game: 'csgo',
        code: weaponCode,
        name: weaponCode,
        modifier: 1,
        kills: 0,
        headshots: 0,
      })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: {
          code: weaponCode,
          game: 'csgo',
          name: weaponCode,
          modifier: 1,
          kills: 0,
          headshots: 0,
          shots: { increment: 1 },
        },
        update: updates,
      })
    })

    it('should handle multiple stat updates', async () => {
      const weaponCode = 'm4a1'
      const updates = {
        shots: { increment: 10 },
        hits: { increment: 7 },
        damage: { increment: 350 },
      }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({ weaponId: 1, code: weaponCode, kills: 0, headshots: 0, name: weaponCode, game: 'csgo', modifier: 1 })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: {
          code: weaponCode,
          game: 'csgo',
          name: weaponCode,
          modifier: 1,
          kills: 0,
          headshots: 0,
          shots: { increment: 10 },
          hits: { increment: 7 },
          damage: { increment: 350 },
        },
        update: updates,
      })
    })

    it('should handle transaction option', async () => {
      const weaponCode = 'awp'
      const updates = { damage: { increment: 100 } }
      const options = { transaction: mockDatabase.prisma }

      await weaponRepository.updateWeaponStats(weaponCode, updates, options)

      // The actual transaction handling is in the base repository
      // We just verify the method was called without throwing
      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalled()
    })
  })

  describe('findWeaponByCode', () => {
    it('should find weapon by code', async () => {
      const weaponCode = 'ak47'
      const mockWeapon = {
        weaponId: 3,
        game: 'csgo',
        code: weaponCode,
        name: weaponCode,
        modifier: 1,
        kills: 100,
        headshots: 25,
      }

      mockDatabase.prisma.weapon.findUnique.mockResolvedValue(mockWeapon)

      const result = await weaponRepository.findWeaponByCode(weaponCode)

      expect(result).toEqual(mockWeapon)
      expect(mockDatabase.prisma.weapon.findUnique).toHaveBeenCalledWith({
        where: { code: weaponCode },
        include: undefined,
        select: undefined,
      })
    })

    it('should return null for non-existent weapon', async () => {
      const weaponCode = 'non_existent'

      mockDatabase.prisma.weapon.findUnique.mockResolvedValue(null)

      const result = await weaponRepository.findWeaponByCode(weaponCode)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.weapon.findUnique).toHaveBeenCalledWith({
        where: { code: weaponCode },
        include: undefined,
        select: undefined,
      })
    })

    it('should handle find options', async () => {
      const weaponCode = 'glock'
      const options = {
        include: { kills: true },
        select: { weapon: true, shots: true },
      }

      mockDatabase.prisma.weapon.findUnique.mockResolvedValue({
        weaponId: 4,
        game: 'csgo',
        code: weaponCode,
        name: weaponCode,
        modifier: 1,
        kills: 0,
        headshots: 0,
      })

      await weaponRepository.findWeaponByCode(weaponCode, options)

      expect(mockDatabase.prisma.weapon.findUnique).toHaveBeenCalledWith({
        where: { code: weaponCode },
        include: options.include,
        select: options.select,
      })
    })

    it('should handle transaction option in find', async () => {
      const weaponCode = 'deagle'
      const options = { transaction: mockDatabase.prisma }

      await weaponRepository.findWeaponByCode(weaponCode, options)

      // Verify the method was called without throwing
      expect(mockDatabase.prisma.weapon.findUnique).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle database errors in updateWeaponStats', async () => {
      const weaponCode = 'error_weapon'
      const updates = { shots: { increment: 1 } }

      mockDatabase.prisma.weapon.upsert.mockRejectedValue(new Error('Database error'))

      // The base repository should handle errors, but let's test graceful handling
      await expect(weaponRepository.updateWeaponStats(weaponCode, updates))
        .rejects.toThrow()
    })

    it('should handle database errors in findWeaponByCode', async () => {
      const weaponCode = 'error_weapon'

      mockDatabase.prisma.weapon.findUnique.mockRejectedValue(new Error('Database error'))

      await expect(weaponRepository.findWeaponByCode(weaponCode))
        .rejects.toThrow()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty weapon code', async () => {
      const weaponCode = ''
      const updates = { shots: { increment: 1 } }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({ weaponId: 1, code: weaponCode, kills: 0, headshots: 0, name: weaponCode, game: 'csgo', modifier: 1 })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: '' },
        create: {
          code: '',
          game: 'csgo',
          name: '',
          modifier: 1,
          kills: 0,
          headshots: 0,
          shots: { increment: 1 },
        },
        update: updates,
      })
    })

    it('should handle very long weapon codes', async () => {
      const weaponCode = 'a'.repeat(100)
      const updates = { shots: { increment: 1 } }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({ weaponId: 1, code: weaponCode, kills: 0, headshots: 0, name: weaponCode, game: 'csgo', modifier: 1 })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: expect.objectContaining({
          code: weaponCode,
        }),
        update: updates,
      })
    })

    it('should handle special characters in weapon codes', async () => {
      const weaponCode = 'weapon-with_special.chars!'
      const updates = { hits: { increment: 1 } }

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({ weaponId: 1, code: weaponCode, kills: 0, headshots: 0, name: weaponCode, game: 'csgo', modifier: 1 })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: expect.objectContaining({
          code: weaponCode,
        }),
        update: updates,
      })
    })

    it('should handle empty updates object', async () => {
      const weaponCode = 'ak47'
      const updates = {}

      mockDatabase.prisma.weapon.upsert.mockResolvedValue({ weaponId: 1, code: weaponCode, kills: 0, headshots: 0, name: weaponCode, game: 'csgo', modifier: 1 })

      await weaponRepository.updateWeaponStats(weaponCode, updates)

      expect(mockDatabase.prisma.weapon.upsert).toHaveBeenCalledWith({
        where: { code: weaponCode },
        create: {
          code: weaponCode,
          game: 'csgo',
          name: weaponCode,
          modifier: 1,
          kills: 0,
          headshots: 0,
        },
        update: updates,
      })
    })
  })
})