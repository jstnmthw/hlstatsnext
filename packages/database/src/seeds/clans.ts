import { faker } from "@faker-js/faker";
import { db } from "../index";
import { getSeedConfig } from "./config";
import { generateClanData } from "./utils";

export async function seedClans() {
  console.log("🏰 Seeding clans...");

  const config = getSeedConfig();
  const { count } = config.clans;

  // Get available games (all games for random distribution)
  const availableGames = await db.game.findMany({
    select: { code: true, name: true },
  });

  if (availableGames.length === 0) {
    throw new Error("No games found. Please ensure Games are seeded first.");
  }

  console.log(
    `📊 Creating ${count} clans randomly distributed across ${availableGames.length} games`
  );

  const gameCodes = availableGames.map((g) => g.code);

  // Create clans in batches for better performance
  const batchSize = 50;
  const clans = [];

  for (let i = 0; i < count; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, count);
    const batchClans = [];

    for (let j = i; j < batchEnd; j++) {
      // Select random game
      const selectedGame = faker.helpers.arrayElement(gameCodes) || "css";

      const clanData = generateClanData();

      batchClans.push(
        db.clan.upsert({
          where: { clanId: j + 1 },
          update: {},
          create: {
            tag: clanData.tag,
            name: clanData.name,
            homepage: clanData.homepage ?? undefined,
            game: selectedGame,
            hidden: 0,
            mapregion: clanData.mapregion,
          },
        })
      );
    }

    const batchResults = await Promise.all(batchClans);
    clans.push(...batchResults);

    if (batchEnd < count) {
      console.log(`⚡ Created ${batchEnd}/${count} clans...`);
    }
  }

  console.log(`✅ Created ${clans.length} clans`);

  // Log distribution stats
  const distributionStats = new Map<string, number>();
  for (const clan of clans) {
    const currentCount = distributionStats.get(clan.game) || 0;
    distributionStats.set(clan.game, currentCount + 1);
  }

  console.log("📈 Clan distribution by game:");
  for (const [game, clanCount] of distributionStats.entries()) {
    const gameName = availableGames.find((g) => g.code === game)?.name || game;
    const percentage = Math.round((clanCount / clans.length) * 100);
    console.log(
      `   ${game} (${gameName}): ${clanCount} clans (${percentage}%)`
    );
  }

  return clans;
}
