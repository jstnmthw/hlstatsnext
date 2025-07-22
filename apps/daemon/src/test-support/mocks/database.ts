/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { MockedFunction } from "vitest"
import type { TransactionalPrisma } from "@/database/client"
import { vi } from "vitest"

export interface MockDatabaseClient {
  prisma: TransactionalPrisma
  testConnection: MockedFunction<() => Promise<boolean>>
  disconnect: MockedFunction<() => Promise<void>>
  transaction: MockedFunction<
    (callback: (prisma: TransactionalPrisma) => Promise<void>) => Promise<void>
  >
}

/**
 * Deeply mock any object
 *
 * This function creates a proxy that can be used to mock any object.
 * It is useful for mocking the database client in tests.
 *
 * @example
 * const prisma = deepMock<TransactionalPrisma>()
 * prisma.player.findUnique = vi.fn()
 * prisma.player.update = vi.fn()
 * prisma.player.create = vi.fn()
 * prisma.player.findMany = vi.fn()
 *
 */
export function deepMock<T extends object>(): T {
  const cache = new Map<string, unknown>()

  function makeProxy(path: string[] = [], isFunction = false): unknown {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") return undefined
        if (prop === Symbol.iterator) {
          return function* () {}
        }
        const key = [...path, String(prop)].join(".")
        if (cache.has(key)) {
          return cache.get(key)
        }
        const value = makeProxy([...path, String(prop)], false)
        cache.set(key, value)
        return value
      },
      set(_target, prop, value) {
        const key = [...path, String(prop)].join(".")
        cache.set(key, value)
        return true
      },
      apply(_target, _thisArg, _args) {
        const key = path.join(".")
        if (!cache.has(key)) {
          cache.set(key, vi.fn())
        }
        return (cache.get(key) as unknown as (...args: unknown[]) => unknown)(..._args)
      },
    }
    return new Proxy(isFunction ? function () {} : {}, handler)
  }

  return makeProxy([], false) as T
}

export function createMockDatabaseClient(): MockDatabaseClient {
  const prisma = deepMock<TransactionalPrisma>()

  return {
    prisma,
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((cb: (prisma: TransactionalPrisma) => Promise<void>) => cb(prisma)),
  }
}
