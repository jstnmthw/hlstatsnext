/**
 * Minimal Seed Data for Integration Tests
 *
 * Seeds the test database with the minimum reference data needed
 * for repositories and services to function.
 */

import type { PrismaClient } from "@repo/db/client"

export async function seedMinimalData(db: InstanceType<typeof PrismaClient>): Promise<void> {
  // Seed supported games
  await db.game.upsert({
    where: { code: "cstrike" },
    update: {},
    create: { code: "cstrike", name: "Counter-Strike 1.6" },
  })

  await db.game.upsert({
    where: { code: "csgo" },
    update: {},
    create: { code: "csgo", name: "Counter-Strike: Global Offensive" },
  })

  // Seed a country for GeoIP lookups
  await db.country.upsert({
    where: { flag: "US" },
    update: {},
    create: { flag: "US", name: "United States" },
  })

  await db.country.upsert({
    where: { flag: "" },
    update: {},
    create: { flag: "", name: "Unknown" },
  })

  // Seed server config defaults commonly used by repositories
  const defaults = [
    { parameter: "MinPlayers", value: "0" },
    { parameter: "MinActivity", value: "0" },
    { parameter: "SkillMaxChange", value: "50" },
    { parameter: "EnableMapStats", value: "1" },
  ]

  for (const def of defaults) {
    await db.serverConfigDefault.upsert({
      where: { parameter: def.parameter },
      update: {},
      create: def,
    })
  }
}
