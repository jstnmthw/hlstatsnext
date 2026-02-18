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
 * Delete all transactional/test data between tests.
 * Preserves seed data in reference tables (games, countries, servers_config_default).
 *
 * Runs inside an interactive transaction so that SET FOREIGN_KEY_CHECKS=0 applies
 * on the same connection as all subsequent DELETEs — avoiding the connection-pool
 * issue where the session variable is set on one connection but queries run on
 * another.
 *
 * Table names must match the @@map() directives in schema.prisma exactly.
 */
export async function cleanAllTables(): Promise<void> {
  const db = getTestDb()

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")

    // All tables in a single ordered list — child tables before parents so that
    // the deletes would work even without the FK-check override above.
    // IMPORTANT: names must match @@map() in schema.prisma, not Prisma model names.
    const tables = [
      // Event / transactional tables (reference players, servers, actions)
      "events_frag",
      "events_chat",
      "events_connect",
      "events_disconnect",
      "events_entry",
      "events_change_name",
      "events_change_role",
      "events_change_team",
      "events_suicide",
      "events_teamkill",
      "events_player_action",
      "events_player_player_action",
      "events_team_bonus",
      "events_world_action",
      "events_rcon",
      "events_admin",
      "events_latency",
      "players_history",
      "players_names",
      "players_awards",
      "players_ribbons",
      "map_counts",
      "servers_load",
      "notification_config",
      // Entity tables — child-to-parent order
      "player_unique_ids",
      "players",
      "weapons",
      "actions",
      "servers_config",
      "servers",
    ]

    for (const table of tables) {
      try {
        await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``)
      } catch {
        // Table may not exist in all schema versions — skip silently
      }
    }

    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1")
  })
}
