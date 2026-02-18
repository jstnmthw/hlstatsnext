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
 * Preserves seed data in reference tables (games, countries, server_config_defaults).
 *
 * Runs inside an interactive transaction so that SET FOREIGN_KEY_CHECKS=0 applies
 * on the same connection as all subsequent DELETEs — avoiding the connection-pool
 * issue where the session variable is set on one connection but queries run on
 * another.
 */
export async function cleanAllTables(): Promise<void> {
  const db = getTestDb()

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")

    // All tables in a single ordered list — child tables before parents so that
    // the deletes would work even without the FK-check override above.
    const tables = [
      // Event / transactional tables (reference players, servers, actions)
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
      "notification_configs",
      // Entity tables — child-to-parent order
      "player_unique_ids",
      "players",
      "weapons",
      "actions",
      "server_configs",
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
