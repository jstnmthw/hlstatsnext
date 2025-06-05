import { faker } from "@faker-js/faker";
import { db } from "../index";
import { getSeedConfig } from "./config";
import { generateSteamId } from "./utils";

export async function seedPlayerUniqueIds() {
  console.log("🆔 Seeding player unique IDs...");

  const config = getSeedConfig();
  const { additionalIdsPerPlayer, multiGamePlayersPercentage } =
    config.playerUniqueIds;

  // Get all existing players
  const players = await db.player.findMany({
    select: { playerId: true, game: true, lastName: true },
    orderBy: { playerId: "asc" },
  });

  if (players.length === 0) {
    throw new Error(
      "Players not found. Please ensure Players are seeded first."
    );
  }

  // Get available games for cross-game IDs
  const availableGames = await db.game.findMany({
    where: { hidden: "0" },
    select: { code: true, name: true },
  });

  console.log(
    `🎮 Creating Steam IDs for ${players.length} players across ${availableGames.length} games`
  );

  const multiGamePlayers = Math.round(
    players.length * (multiGamePlayersPercentage || 0.3)
  );
  const additionalIds = additionalIdsPerPlayer || 2;

  console.log(`🔄 ${multiGamePlayers} players will have cross-game Steam IDs`);

  const playerUniqueIds = [];

  // Create primary Steam ID for each player in their main game
  const primaryIds = await Promise.all(
    players.map(async (player) => {
      const steamId = generateSteamId();

      return db.playerUniqueId.upsert({
        where: {
          uniqueId_game: {
            uniqueId: steamId,
            game: player.game,
          },
        },
        update: {},
        create: {
          playerId: player.playerId,
          uniqueId: steamId,
          game: player.game,
        },
      });
    })
  );

  playerUniqueIds.push(...primaryIds);
  console.log(`✅ Created ${primaryIds.length} primary Steam IDs`);

  // Create additional Steam IDs for multi-game players
  const additionalUniqueIds = [];
  const selectedMultiGamePlayers = faker.helpers.arrayElements(
    players,
    multiGamePlayers
  );

  for (const player of selectedMultiGamePlayers) {
    // Get games different from the player's main game
    const otherGames = availableGames.filter(
      (game) => game.code !== player.game
    );

    if (otherGames.length === 0) continue;

    // Select random number of additional games (up to additionalIds limit)
    const numAdditionalGames = Math.min(
      faker.number.int({ min: 1, max: additionalIds }),
      otherGames.length
    );

    const selectedGames = faker.helpers.arrayElements(
      otherGames,
      numAdditionalGames
    );

    for (const game of selectedGames) {
      const steamId = generateSteamId();

      additionalUniqueIds.push(
        db.playerUniqueId.upsert({
          where: {
            uniqueId_game: {
              uniqueId: steamId,
              game: game.code,
            },
          },
          update: {},
          create: {
            playerId: player.playerId,
            uniqueId: steamId,
            game: game.code,
          },
        })
      );
    }
  }

  let additionalResults: Awaited<
    ReturnType<typeof db.playerUniqueId.upsert>
  >[] = [];
  if (additionalUniqueIds.length > 0) {
    additionalResults = await Promise.all(additionalUniqueIds);
    playerUniqueIds.push(...additionalResults);
    console.log(
      `🔄 Created ${additionalResults.length} additional cross-game Steam IDs`
    );
  } else {
    console.log(
      "🔄 No additional cross-game Steam IDs created (all players in same game or no other games available)"
    );
  }

  const totalIds = playerUniqueIds.length;
  console.log(`✅ Created ${totalIds} total Steam IDs`);

  // Log distribution stats
  const gameStats = new Map<string, number>();
  for (const uniqueId of playerUniqueIds) {
    const currentCount = gameStats.get(uniqueId.game) || 0;
    gameStats.set(uniqueId.game, currentCount + 1);
  }

  console.log("📈 Steam ID distribution by game:");
  for (const [game, count] of gameStats.entries()) {
    const gameName = availableGames.find((g) => g.code === game)?.name || game;
    const percentage = Math.round((count / totalIds) * 100);
    console.log(
      `   ${game} (${gameName}): ${count} Steam IDs (${percentage}%)`
    );
  }

  return {
    playerUniqueIds: primaryIds,
    additionalIds: additionalResults,
    totalCreated: totalIds,
  };
}
