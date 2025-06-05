import { db } from "./index";
import {
  seedClans,
  seedPlayers,
  seedPlayerUniqueIds,
  getSeedConfig,
} from "./seeds";

async function main() {
  console.log("🌱 Starting database seeding...");
  console.log("🔍 Assuming Games and Countries are already seeded");

  // Show current configuration
  const config = getSeedConfig();
  const env = process.env.NODE_ENV || "development";
  console.log(`⚙️ Using ${env} configuration:`);
  console.log(`   Clans: ${config.clans.count}`);
  console.log(`   Players: ${config.players.count}`);
  console.log(
    `   Multi-game players: ${Math.round((config.playerUniqueIds.multiGamePlayersPercentage || 0.3) * 100)}%`
  );

  try {
    // Verify required data exists
    const gameCount = await db.game.count();
    const countryCount = await db.country.count();

    if (gameCount === 0) {
      throw new Error("No games found. Please seed Games first.");
    }

    if (countryCount === 0) {
      throw new Error("No countries found. Please seed Countries first.");
    }

    console.log(`✅ Found ${gameCount} games and ${countryCount} countries`);

    const startTime = Date.now();

    // Seed in dependency order: Clans → Players → PlayerUniqueIds
    console.log("\n🏰 Step 1: Seeding clans...");
    await seedClans();

    console.log("\n👥 Step 2: Seeding players...");
    await seedPlayers();

    console.log("\n🆔 Step 3: Seeding player unique IDs...");
    await seedPlayerUniqueIds();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `\n🎉 Database seeding completed successfully in ${duration}s!`
    );

    // Show final stats
    const finalStats = await Promise.all([
      db.clan.count(),
      db.player.count(),
      db.playerUniqueId.count(),
    ]);

    console.log("\n📊 Final database statistics:");
    console.log(`   Total clans: ${finalStats[0]}`);
    console.log(`   Total players: ${finalStats[1]}`);
    console.log(`   Total Steam IDs: ${finalStats[2]}`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
