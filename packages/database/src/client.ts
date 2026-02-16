import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import "dotenv/config"
import type { PrismaClient as BasePrismaClient } from "../generated/prisma/client"
import { PrismaClient } from "../generated/prisma/client"

export type { PrismaClient } from "../generated/prisma/client"

export function createAdapter(): PrismaMariaDb {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required")
  }
  return new PrismaMariaDb(url)
}

declare global {
  var cachedPrisma: BasePrismaClient
}

let prisma: BasePrismaClient
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter: createAdapter() })
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient({ adapter: createAdapter() })
  }
  prisma = global.cachedPrisma
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
