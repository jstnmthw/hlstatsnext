import { db } from "../index";

export async function seedPlayerUniqueIds() {
  console.log("🆔 Seeding player unique IDs...");

  // Get games that should already exist
  const tfGame = await db.game.findFirst({ where: { code: "tfc" } });
  const tf2Game = await db.game.findFirst({ where: { code: "tf" } });
  const cssGame = await db.game.findFirst({ where: { code: "css" } });

  if (!tfGame || !tf2Game || !cssGame) {
    throw new Error(
      "Required games not found. Please ensure Games are seeded first."
    );
  }

  // Get players that should already exist
  const players = await db.player.findMany({
    where: {
      playerId: { in: [1, 2, 3, 4, 5, 6, 7, 8] },
    },
    orderBy: { playerId: "asc" },
  });

  if (players.length === 0) {
    throw new Error(
      "Players not found. Please ensure Players are seeded first."
    );
  }

  const steamIds = [
    "STEAM_0:0:12345678", // HeavyWeaponsGuy
    "STEAM_0:1:87654321", // Scout
    "STEAM_0:0:11223344", // Sniper
    "STEAM_0:1:44332211", // Pyro
    "STEAM_0:0:55667788", // HeadHunter
    "STEAM_0:1:99887766", // RushB
    "STEAM_0:0:13579246", // Medic
    "STEAM_0:1:24681357", // SoloPlayer
  ];

  const playerUniqueIds = await Promise.all(
    players.map(async (player, index) => {
      const steamId = steamIds[index];
      if (!steamId) {
        throw new Error(`No Steam ID available for player ${player.playerId}`);
      }

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

  // Add some additional Steam IDs for players who might play multiple games
  const additionalIds = await Promise.all([
    // HeavyWeaponsGuy also plays TF2
    db.playerUniqueId.upsert({
      where: {
        uniqueId_game: {
          uniqueId: "STEAM_0:0:12345678",
          game: tf2Game.code,
        },
      },
      update: {},
      create: {
        playerId: 1, // HeavyWeaponsGuy
        uniqueId: "STEAM_0:0:12345678",
        game: tf2Game.code,
      },
    }),
    // Scout also plays CSS
    db.playerUniqueId.upsert({
      where: {
        uniqueId_game: {
          uniqueId: "STEAM_0:1:87654321",
          game: cssGame.code,
        },
      },
      update: {},
      create: {
        playerId: 2, // Scout
        uniqueId: "STEAM_0:1:87654321",
        game: cssGame.code,
      },
    }),
    // HeadHunter also plays TFC
    db.playerUniqueId.upsert({
      where: {
        uniqueId_game: {
          uniqueId: "STEAM_0:0:55667788",
          game: tfGame.code,
        },
      },
      update: {},
      create: {
        playerId: 5, // HeadHunter
        uniqueId: "STEAM_0:0:55667788",
        game: tfGame.code,
      },
    }),
  ]);

  const totalIds = playerUniqueIds.length + additionalIds.length;
  console.log(`✅ Created ${totalIds} player unique IDs`);

  return { playerUniqueIds, additionalIds };
}
