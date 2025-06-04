import { db } from "../index";

export async function seedClans() {
  console.log("🏰 Seeding clans...");

  // Get games that should already exist
  const tfGame = await db.game.findFirst({ where: { code: "tfc" } });
  const tf2Game = await db.game.findFirst({ where: { code: "tf2" } });
  const cssGame = await db.game.findFirst({ where: { code: "css" } });

  if (!tfGame || !tf2Game || !cssGame) {
    throw new Error(
      "Required games not found. Please ensure Games are seeded first."
    );
  }

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
    db.clan.upsert({
      where: { clanId: 5 },
      update: {},
      create: {
        tag: "[T]",
        name: "Terrorists",
        homepage: "https://tteam.example.com",
        game: cssGame.code,
        hidden: 0,
        mapregion: "Europe",
      },
    }),
  ]);

  console.log(`✅ Created ${clans.length} clans`);
  return clans;
}
