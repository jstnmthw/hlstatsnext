/**
 * Test Database Utilities
 *
 * Provides a real PrismaClient connected to the test MySQL instance
 * and utilities for table cleanup between tests.
 */

import { createAdapter, PrismaClient } from "@repo/db/client"

let testDb: PrismaClient | null = null

/**
 * Get (or create) a PrismaClient connected to the test database.
 * The connection URL is read from DATABASE_URL which should point to port 3307.
 */
export function getTestDb(): PrismaClient {
  if (!testDb) {
    testDb = new PrismaClient({ adapter: createAdapter() })
  }
  return testDb
}

/**
 * Disconnect the test PrismaClient.
 */
export async function disconnectTestDb(): Promise<void> {
  if (testDb) {
    await testDb.$disconnect()
    testDb = null
  }
}

/**
 * Truncate all event/transactional tables between tests.
 * Preserves seed data in reference tables (games, countries, server_config_defaults).
 *
 * Uses SET FOREIGN_KEY_CHECKS=0 to allow truncation regardless of FK constraints,
 * then re-enables them after cleanup.
 */
export async function cleanAllTables(): Promise<void> {
  const db = getTestDb()

  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")

  // Event tables — truncate for speed
  const eventTables = [
    "event_frags",
    "event_chat",
    "event_connect",
    "event_disconnect",
    "event_entry",
    "event_change_name",
    "event_change_role",
    "event_change_team",
    "event_suicide",
    "event_teamkills",
    "event_player_actions",
    "event_player_player_actions",
    "event_team_bonuses",
    "event_world_actions",
    "event_rcon",
    "event_admin",
    "event_latency",
    "player_histories",
    "player_names",
    "player_awards",
    "player_ribbons",
    "map_counts",
    "server_loads",
  ]

  for (const table of eventTables) {
    try {
      await db.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``)
    } catch {
      // Table may not exist in all schema versions — skip silently
    }
  }

  // Entity tables — delete to allow auto-increment reset while preserving FK structure
  const entityTables = [
    "player_unique_ids",
    "players",
    "weapons",
    "actions",
    "server_configs",
    "servers",
  ]

  for (const table of entityTables) {
    try {
      await db.$executeRawUnsafe(`DELETE FROM \`${table}\``)
    } catch {
      // Skip if table doesn't exist
    }
  }

  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1")
}
