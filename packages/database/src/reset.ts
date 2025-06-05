import { db } from "./index";

/**
 * Reset development data from the database.
 * This script clears out data that was added during development/testing
 * while preserving the initial seeded data from the SQL installation script.
 *
 * Tables that will be cleared:
 * - Players
 * - PlayerUniqueIds
 * - Clans
 *
 * Tables that will be preserved:
 * - Games (initial seeded data)
 * - Countries (initial seeded data)
 * - Any other initial schema data
 */
async function resetDatabase() {
  console.log("🗑️  Starting database reset...");
  console.log(
    "⚠️  This will clear development data while preserving initial seeded data"
  );

  try {
    // Show current data before reset
    const beforeStats = await Promise.all([
      db.clan.count(),
      db.player.count(),
      db.playerUniqueId.count(),
    ]);

    console.log("\n📊 Current database statistics:");
    console.log(`   Clans: ${beforeStats[0]}`);
    console.log(`   Players: ${beforeStats[1]}`);
    console.log(`   Player Unique IDs: ${beforeStats[2]}`);

    if (beforeStats.every((count) => count === 0)) {
      console.log(
        "✅ Database is already clean - no development data to reset"
      );
      return;
    }

    const startTime = Date.now();

    // Clear tables in dependency order (reverse of seeding order)
    // PlayerUniqueIds → Players → Clans
    console.log("\n🧹 Step 1: Clearing player unique IDs...");
    const deletedPlayerUniqueIds = await db.playerUniqueId.deleteMany();
    console.log(`   Deleted ${deletedPlayerUniqueIds.count} player unique IDs`);

    console.log("\n🧹 Step 2: Clearing players...");
    const deletedPlayers = await db.player.deleteMany();
    console.log(`   Deleted ${deletedPlayers.count} players`);

    console.log("\n🧹 Step 3: Clearing clans...");
    const deletedClans = await db.clan.deleteMany();
    console.log(`   Deleted ${deletedClans.count} clans`);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Database reset completed successfully in ${duration}s!`);

    // Verify preserved data still exists
    const gameCount = await db.game.count();
    const countryCount = await db.country.count();

    console.log("\n✅ Verified preserved initial seeded data:");
    console.log(`   Games: ${gameCount}`);
    console.log(`   Countries: ${countryCount}`);

    // Show final stats
    const afterStats = await Promise.all([
      db.clan.count(),
      db.player.count(),
      db.playerUniqueId.count(),
    ]);

    console.log("\n📊 Final database statistics:");
    console.log(`   Clans: ${afterStats[0]}`);
    console.log(`   Players: ${afterStats[1]}`);
    console.log(`   Player Unique IDs: ${afterStats[2]}`);
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    throw error;
  }
}

async function main() {
  try {
    await resetDatabase();
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

export { resetDatabase };
