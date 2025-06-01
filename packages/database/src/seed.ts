import { db } from "./index";

async function main() {
  console.log("🌱 Starting database seeding...");

  // Seed Games based on legacy hlstats_Games data
  console.log("📦 Seeding games...");
  const games = await Promise.all([
    db.game.upsert({
      where: { code: "tfc" },
      update: {},
      create: {
        code: "tfc",
        name: "Team Fortress Classic",
        realgame: "tfc",
        hidden: "0",
      },
    }),
    db.game.upsert({
      where: { code: "tf2" },
      update: {},
      create: {
        code: "tf2",
        name: "Team Fortress 2",
        realgame: "tf2",
        hidden: "0",
      },
    }),
    db.game.upsert({
      where: { code: "css" },
      update: {},
      create: {
        code: "css",
        name: "Counter-Strike: Source",
        realgame: "css",
        hidden: "0",
      },
    }),
    db.game.upsert({
      where: { code: "csgo" },
      update: {},
      create: {
        code: "csgo",
        name: "Counter-Strike: Global Offensive",
        realgame: "csgo",
        hidden: "0",
      },
    }),
    db.game.upsert({
      where: { code: "cs2" },
      update: {},
      create: {
        code: "cs2",
        name: "Counter-Strike 2",
        realgame: "cs2",
        hidden: "0",
      },
    }),
    db.game.upsert({
      where: { code: "l4d2" },
      update: {},
      create: {
        code: "l4d2",
        name: "Left 4 Dead 2",
        realgame: "l4d",
        hidden: "0",
      },
    }),
  ]);

  console.log(`✅ Created ${games.length} games`);

  // Seed Countries based on legacy hlstats_Countries data
  console.log("🌍 Seeding countries...");
  const countries = await Promise.all([
    db.country.upsert({
      where: { flag: "US" },
      update: {},
      create: { flag: "US", name: "United States" },
    }),
    db.country.upsert({
      where: { flag: "CA" },
      update: {},
      create: { flag: "CA", name: "Canada" },
    }),
    db.country.upsert({
      where: { flag: "GB" },
      update: {},
      create: { flag: "GB", name: "United Kingdom" },
    }),
    db.country.upsert({
      where: { flag: "DE" },
      update: {},
      create: { flag: "DE", name: "Germany" },
    }),
    db.country.upsert({
      where: { flag: "FR" },
      update: {},
      create: { flag: "FR", name: "France" },
    }),
    db.country.upsert({
      where: { flag: "AU" },
      update: {},
      create: { flag: "AU", name: "Australia" },
    }),
    db.country.upsert({
      where: { flag: "JP" },
      update: {},
      create: { flag: "JP", name: "Japan" },
    }),
    db.country.upsert({
      where: { flag: "BR" },
      update: {},
      create: { flag: "BR", name: "Brazil" },
    }),
  ]);

  console.log(`✅ Created ${countries.length} countries`);

  // Create sample clans for Team Fortress 2
  console.log("🏰 Seeding clans...");
  const tfGame = games.find((g) => g.code === "tfc");
  const tf2Game = games.find((g) => g.code === "tf2");
  const cssGame = games.find((g) => g.code === "css");

  if (tfGame && tf2Game && cssGame) {
    const clans = await Promise.all([
      db.clan.upsert({
        where: { clanId: 1 },
        update: {},
        create: {
          tag: "[BLK]",
          name: "BLK Team Fortress Classic",
          homepage: "https://blkteam.example.com",
          game: tfGame.code,
          hidden: 0,
          mapregion: "North America",
        },
      }),
      db.clan.upsert({
        where: { clanId: 2 },
        update: {},
        create: {
          tag: "[RED]",
          name: "RED Team Fortress 2",
          homepage: "https://redteam.example.com",
          game: tf2Game.code,
          hidden: 0,
          mapregion: "North America",
        },
      }),
      db.clan.upsert({
        where: { clanId: 3 },
        update: {},
        create: {
          tag: "[BLU]",
          name: "BLU Team Fortress",
          homepage: "https://bluteam.example.com",
          game: tfGame.code,
          hidden: 0,
          mapregion: "Europe",
        },
      }),
      db.clan.upsert({
        where: { clanId: 4 },
        update: {},
        create: {
          tag: "[CT]",
          name: "Counter-Terrorists",
          homepage: "https://ctteam.example.com",
          game: cssGame.code,
          hidden: 0,
          mapregion: "North America",
        },
      }),
    ]);

    console.log(`✅ Created ${clans.length} clans`);

    // Create sample players with realistic data
    console.log("👥 Seeding players...");
    const usCountry = countries.find((c) => c.flag === "US");
    const caCountry = countries.find((c) => c.flag === "CA");
    const gbCountry = countries.find((c) => c.flag === "GB");

    const redClan = clans.find((c) => c.tag === "[RED]");
    const bluClan = clans.find((c) => c.tag === "[BLU]");

    const players = await Promise.all([
      db.player.upsert({
        where: { playerId: 1 },
        update: {},
        create: {
          lastName: "HeavyWeaponsGuy",
          fullName: "Heavy Weapons Guy",
          game: tfGame.code,
          country: usCountry?.flag,
          clan: redClan?.clanId,
          skill: 1250,
          kills: 1500,
          deaths: 800,
          headshots: 45,
          shots: 8000,
          hits: 3200,
          connection_time: 86400, // 24 hours
          city: "San Francisco",
          state: "California",
        },
      }),
      db.player.upsert({
        where: { playerId: 2 },
        update: {},
        create: {
          lastName: "Scout",
          fullName: "The Scout",
          game: tfGame.code,
          country: usCountry?.flag,
          clan: redClan?.clanId,
          skill: 1180,
          kills: 980,
          deaths: 650,
          headshots: 12,
          shots: 5500,
          hits: 2100,
          connection_time: 72000, // 20 hours
          city: "Boston",
          state: "Massachusetts",
        },
      }),
      db.player.upsert({
        where: { playerId: 3 },
        update: {},
        create: {
          lastName: "Sniper",
          fullName: "The Sniper",
          game: tfGame.code,
          country: gbCountry?.flag,
          clan: bluClan?.clanId,
          skill: 1350,
          kills: 1200,
          deaths: 400,
          headshots: 800, // High headshot ratio for sniper
          shots: 2000,
          hits: 1400,
          connection_time: 94000, // 26+ hours
          city: "London",
          state: "England",
        },
      }),
      db.player.upsert({
        where: { playerId: 4 },
        update: {},
        create: {
          lastName: "Pyro",
          fullName: "The Pyro",
          game: tfGame.code,
          country: caCountry?.flag,
          skill: 1050,
          kills: 750,
          deaths: 890,
          headshots: 5, // Low headshots for pyro
          shots: 4000,
          hits: 2800,
          connection_time: 45000, // 12.5 hours
          city: "Toronto",
          state: "Ontario",
        },
      }),
    ]);

    console.log(`✅ Created ${players.length} players`);

    // Create PlayerUniqueIds (Steam IDs)
    console.log("🆔 Seeding player unique IDs...");
    const playerUniqueIds = await Promise.all([
      db.playerUniqueId.upsert({
        where: {
          uniqueId_game: {
            uniqueId: "STEAM_0:0:12345678",
            game: tfGame.code,
          },
        },
        update: {},
        create: {
          playerId: players[0].playerId,
          uniqueId: "STEAM_0:0:12345678",
          game: tfGame.code,
        },
      }),
      db.playerUniqueId.upsert({
        where: {
          uniqueId_game: {
            uniqueId: "STEAM_0:1:87654321",
            game: tfGame.code,
          },
        },
        update: {},
        create: {
          playerId: players[1].playerId,
          uniqueId: "STEAM_0:1:87654321",
          game: tfGame.code,
        },
      }),
      db.playerUniqueId.upsert({
        where: {
          uniqueId_game: {
            uniqueId: "STEAM_0:0:11223344",
            game: tfGame.code,
          },
        },
        update: {},
        create: {
          playerId: players[2].playerId,
          uniqueId: "STEAM_0:0:11223344",
          game: tfGame.code,
        },
      }),
      db.playerUniqueId.upsert({
        where: {
          uniqueId_game: {
            uniqueId: "STEAM_0:1:44332211",
            game: tfGame.code,
          },
        },
        update: {},
        create: {
          playerId: players[3].playerId,
          uniqueId: "STEAM_0:1:44332211",
          game: tfGame.code,
        },
      }),
    ]);

    console.log(`✅ Created ${playerUniqueIds.length} player unique IDs`);
  }

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
