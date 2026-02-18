import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import "dotenv/config"
import type { PrismaClient as BasePrismaClient } from "../generated/prisma/client"
import { PrismaClient } from "../generated/prisma/client"

export { PrismaClient } from "../generated/prisma/client"

export function createAdapter(): PrismaMariaDb {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required")
  }

  // The mariadb driver requires the mariadb:// protocol for URL parsing
  // (mysql:// is rejected). Also enable allowPublicKeyRetrieval so the
  // driver can complete MySQL 8.4's caching_sha2_password RSA handshake
  // on first connection after a fresh server start (e.g. Docker restart).
  const adapterUrl = url.replace(/^mysql:/, "mariadb:")
  const separator = adapterUrl.includes("?") ? "&" : "?"
  return new PrismaMariaDb(`${adapterUrl}${separator}allowPublicKeyRetrieval=true`)
}

declare global {
  var cachedPrisma: BasePrismaClient
}

let prisma: BasePrismaClient
if (process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient({ adapter: createAdapter() })
  } else {
    if (!global.cachedPrisma) {
      global.cachedPrisma = new PrismaClient({ adapter: createAdapter() })
    }
    prisma = global.cachedPrisma
  }
} else {
  // Allow module to load without DATABASE_URL (e.g. in unit tests that mock this module).
  // Any actual usage without mocking will throw at call-site.
  prisma = undefined as unknown as BasePrismaClient
}

export const db = prisma

export async function testConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error("Database connection test failed:", error)
    return false
  }
}

export type * from "../generated/prisma/client"
export { Prisma } from "../generated/prisma/client"
