/**
 * Mock Weapon Repository for testing
 */

import type { IWeaponRepository } from "@/modules/weapon/weapon.types"
import type { FindOptions, UpdateOptions } from "@/shared/types/database"
import { vi } from "vitest"

interface MockWeapon {
  weaponId: number
  game: string
  code: string
  name: string
  modifier: number
  kills: number
  headshots: number
}

export function createMockWeaponRepository(): IWeaponRepository {
  // Default weapon modifiers for testing
  const defaultWeaponData: Record<string, MockWeapon> = {
    awp: {
      weaponId: 1,
      game: "cstrike",
      code: "awp",
      name: "AWP",
      modifier: 1.4,
      kills: 0,
      headshots: 0,
    },
    scout: {
      weaponId: 2,
      game: "cstrike",
      code: "scout",
      name: "Scout",
      modifier: 1.4,
      kills: 0,
      headshots: 0,
    },
    ak47: {
      weaponId: 3,
      game: "cstrike",
      code: "ak47",
      name: "AK-47",
      modifier: 1.0,
      kills: 0,
      headshots: 0,
    },
    m4a1: {
      weaponId: 4,
      game: "cstrike",
      code: "m4a1",
      name: "M4A1",
      modifier: 1.0,
      kills: 0,
      headshots: 0,
    },
    knife: {
      weaponId: 5,
      game: "cstrike",
      code: "knife",
      name: "Knife",
      modifier: 2.0,
      kills: 0,
      headshots: 0,
    },
    deagle: {
      weaponId: 6,
      game: "cstrike",
      code: "deagle",
      name: "Desert Eagle",
      modifier: 0.8,
      kills: 0,
      headshots: 0,
    },
  }

  return {
    updateWeaponStats: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_weaponCode: string, _updates: Record<string, unknown>, _options?: UpdateOptions) => {
        // Mock implementation
      },
    ),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    findWeaponByCode: vi.fn(async (weaponCode: string, _options?: FindOptions) => {
      // Return mock weapon data if it exists
      return defaultWeaponData[weaponCode] || null
    }),
  }
}
