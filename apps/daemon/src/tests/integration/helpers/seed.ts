/**
 * Minimal Seed Data for Integration Tests
 *
 * Seeds the test database with the minimum reference data needed
 * for repositories and services to function.
 *
 * Uses ON DUPLICATE KEY UPDATE instead of INSERT IGNORE so that stale
 * values left by a previous run are always corrected. Prisma v7 +
 * MariaDB adapter generates a bare INSERT (no ON DUPLICATE KEY UPDATE)
 * when update:{} is empty, so we use raw SQL for these reference tables.
 *
 * Table names match the @@map() directives in schema.prisma exactly.
 */

import type { PrismaClient } from "@repo/db/client"

export async function seedMinimalData(db: InstanceType<typeof PrismaClient>): Promise<void> {
  // Seed supported games (@@map("games"))
  await db.$executeRawUnsafe(
    `INSERT INTO \`games\` (\`code\`, \`name\`) VALUES ('cstrike', 'Counter-Strike 1.6'), ('csgo', 'Counter-Strike: Global Offensive')` +
      ` ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)`,
  )

  // Seed countries for GeoIP lookups (@@map("countries"))
  await db.$executeRawUnsafe(
    `INSERT INTO \`countries\` (\`flag\`, \`name\`) VALUES ('US', 'United States'), ('', 'Unknown')` +
      ` ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)`,
  )

  // Seed server config defaults commonly used by repositories (@@map("servers_config_default"))
  await db.$executeRawUnsafe(
    `INSERT INTO \`servers_config_default\` (\`parameter\`, \`value\`) VALUES ` +
      `('MinPlayers', '0'), ('MinActivity', '0'), ('SkillMaxChange', '50'), ('EnableMapStats', '1')` +
      ` ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
  )
}
