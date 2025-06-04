import { db } from "./index";
import { seedClans, seedPlayers, seedPlayerUniqueIds } from "./seeds";

async function main() {
  console.log("🌱 Starting database seeding...");
  console.log("🔍 Assuming Games and Countries are already seeded");

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

    // Seed in dependency order: Clans → Players → PlayerUniqueIds
    await seedClans();
    await seedPlayers();
    await seedPlayerUniqueIds();

    console.log("🎉 Database seeding completed successfully!");
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
