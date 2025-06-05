import { faker } from "@faker-js/faker";
import { db } from "../index";
import { getSeedConfig } from "./config";
import { generateClanData } from "./utils";

export async function seedClans() {
  console.log("🏰 Seeding clans...");

  const config = getSeedConfig();
  const { count, gamesDistribution } = config.clans;

  // Get available games
  const availableGames = await db.game.findMany({
    where: { hidden: "0" }, // Only non-hidden games
    select: { code: true, name: true },
  });

  if (availableGames.length === 0) {
    throw new Error("No games found. Please ensure Games are seeded first.");
  }

  console.log(
    `📊 Creating ${count} clans distributed across ${availableGames.length} games`
  );

  // Determine game distribution
  const gameDistribution = gamesDistribution || {};
  const gameCodes = availableGames.map((g) => g.code);

  // Create clans in batches for better performance
  const batchSize = 50;
  const clans = [];

  for (let i = 0; i < count; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, count);
    const batchClans = [];

    for (let j = i; j < batchEnd; j++) {
      // Select game based on distribution or randomly
      let selectedGame: string;
      if (Object.keys(gameDistribution).length > 0 && gameCodes.length > 0) {
        const weights = gameCodes.map((code) => gameDistribution[code] || 0.1);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = faker.number.float({ min: 0, max: totalWeight });

        selectedGame = gameCodes[0]!; // We know this exists due to length check
        for (let k = 0; k < gameCodes.length; k++) {
          random -= weights[k]!;
          if (random <= 0) {
            selectedGame = gameCodes[k]!;
            break;
          }
        }
      } else {
        selectedGame = gameCodes[0] || "css"; // fallback
      }

      const clanData = generateClanData();

      batchClans.push(
        db.clan.upsert({
          where: { clanId: j + 1 },
          update: {},
          create: {
            tag: clanData.tag,
            name: clanData.name,
            homepage: clanData.homepage,
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
