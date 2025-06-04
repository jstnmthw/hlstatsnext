import { db } from "../index";

export async function seedPlayers() {
  console.log("👥 Seeding players...");

  // Get required data that should already exist
  const tfGame = await db.game.findFirst({ where: { code: "tfc" } });
  const tf2Game = await db.game.findFirst({ where: { code: "tf2" } });
  const cssGame = await db.game.findFirst({ where: { code: "css" } });

  if (!tfGame || !tf2Game || !cssGame) {
    throw new Error(
      "Required games not found. Please ensure Games are seeded first."
    );
  }

  // Get countries
  const usCountry = await db.country.findFirst({ where: { flag: "US" } });
  const caCountry = await db.country.findFirst({ where: { flag: "CA" } });
  const gbCountry = await db.country.findFirst({ where: { flag: "GB" } });
  const deCountry = await db.country.findFirst({ where: { flag: "DE" } });

  // Get clans
  const redClan = await db.clan.findFirst({ where: { tag: "[RED]" } });
  const bluClan = await db.clan.findFirst({ where: { tag: "[BLU]" } });
  const ctClan = await db.clan.findFirst({ where: { tag: "[CT]" } });
  const tClan = await db.clan.findFirst({ where: { tag: "[T]" } });

  const players = await Promise.all([
    // Team Fortress Classic Players
    db.player.upsert({
      where: { playerId: 1 },
      update: {},
      create: {
        lastName: "HeavyWeaponsGuy",
        fullName: "Heavy Weapons Guy",
        email: "heavy@redteam.com",
        homepage: "https://heavyweapons.example.com",
        game: tfGame.code,
        flag: usCountry?.flag ?? "",
        clan: redClan?.clanId ?? 0,
        skill: 1250,
        kills: 1500,
        deaths: 800,
        headshots: 45,
        shots: 8000,
        hits: 3200,
        connection_time: 86400, // 24 hours
        city: "San Francisco",
        state: "California",
        country: "United States",
        lat: 37.7749,
        lng: -122.4194,
        last_event: Math.floor(Date.now() / 1000),
        createdate: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
      },
    }),
    db.player.upsert({
      where: { playerId: 2 },
      update: {},
      create: {
        lastName: "Scout",
        fullName: "The Scout",
        email: "scout@redteam.com",
        game: tfGame.code,
        flag: usCountry?.flag ?? "",
        clan: redClan?.clanId ?? 0,
        skill: 1180,
        kills: 980,
        deaths: 650,
        headshots: 12,
        shots: 5500,
        hits: 2100,
        connection_time: 72000, // 20 hours
        city: "Boston",
        state: "Massachusetts",
        country: "United States",
        lat: 42.3601,
        lng: -71.0589,
        last_event: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 25, // 25 days ago
      },
    }),
    db.player.upsert({
      where: { playerId: 3 },
      update: {},
      create: {
        lastName: "Sniper",
        fullName: "The Sniper",
        email: "sniper@bluteam.com",
        homepage: "https://sniper.example.com",
        game: tfGame.code,
        flag: gbCountry?.flag ?? "",
        clan: bluClan?.clanId ?? 0,
        skill: 1350,
        kills: 1200,
        deaths: 400,
        headshots: 800, // High headshot ratio for sniper
        shots: 2000,
        hits: 1400,
        connection_time: 94000, // 26+ hours
        city: "London",
        state: "England",
        country: "United Kingdom",
        lat: 51.5074,
        lng: -0.1278,
        last_event: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 45, // 45 days ago
      },
    }),
    db.player.upsert({
      where: { playerId: 4 },
      update: {},
      create: {
        lastName: "Pyro",
        fullName: "The Pyro",
        game: tfGame.code,
        flag: caCountry?.flag ?? "",
        skill: 1050,
        kills: 750,
        deaths: 890,
        headshots: 5, // Low headshots for pyro
        shots: 4000,
        hits: 2800,
        connection_time: 45000, // 12.5 hours
        city: "Toronto",
        state: "Ontario",
        country: "Canada",
        lat: 43.6532,
        lng: -79.3832,
        last_event: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 20, // 20 days ago
      },
    }),

    // Counter-Strike Source Players
    db.player.upsert({
      where: { playerId: 5 },
      update: {},
      create: {
        lastName: "HeadHunter",
        fullName: "John 'HeadHunter' Smith",
        email: "headhunter@ctteam.com",
        homepage: "https://headhunter.example.com",
        game: cssGame.code,
        flag: usCountry?.flag ?? "",
        clan: ctClan?.clanId ?? 0,
        skill: 1420,
        kills: 2100,
        deaths: 950,
        headshots: 1200, // High headshot ratio
        shots: 12000,
        hits: 4800,
        connection_time: 120000, // 33+ hours
        city: "New York",
        state: "New York",
        country: "United States",
        lat: 40.7128,
        lng: -74.006,
        last_event: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago
      },
    }),
    db.player.upsert({
      where: { playerId: 6 },
      update: {},
      create: {
        lastName: "RushB",
        fullName: "Boris 'RushB' Petrov",
        email: "rushb@terroristteam.com",
        game: cssGame.code,
        flag: deCountry?.flag ?? "",
        clan: tClan?.clanId ?? 0,
        skill: 1180,
        kills: 1650,
        deaths: 1200,
        headshots: 380,
        shots: 15000,
        hits: 5200,
        connection_time: 89000, // 24+ hours
        city: "Berlin",
        state: "Berlin",
        country: "Germany",
        lat: 52.52,
        lng: 13.405,
        last_event: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 40, // 40 days ago
      },
    }),

    // Team Fortress 2 Player
    db.player.upsert({
      where: { playerId: 7 },
      update: {},
      create: {
        lastName: "Medic",
        fullName: "The Medic",
        email: "medic@redteam.com",
        game: tf2Game.code,
        flag: deCountry?.flag ?? "",
        clan: redClan?.clanId ?? 0,
        skill: 1100,
        kills: 450,
        deaths: 320,
        headshots: 8, // Low headshots for medic
        shots: 2000,
        hits: 1200,
        connection_time: 67000, // 18+ hours
        city: "Munich",
        state: "Bavaria",
        country: "Germany",
        lat: 48.1351,
        lng: 11.582,
        last_event: Math.floor(Date.now() / 1000) - 900, // 15 minutes ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 15, // 15 days ago
      },
    }),

    // Unaffiliated player
    db.player.upsert({
      where: { playerId: 8 },
      update: {},
      create: {
        lastName: "SoloPlayer",
        fullName: "Alex 'Solo' Johnson",
        email: "solo@email.com",
        homepage: "https://solo.example.com",
        game: cssGame.code,
        flag: caCountry?.flag ?? "",
        clan: 0, // No clan
        skill: 980,
        kills: 890,
        deaths: 920,
        headshots: 180,
        shots: 8500,
        hits: 2800,
        connection_time: 34000, // 9+ hours
        city: "Vancouver",
        state: "British Columbia",
        country: "Canada",
        lat: 49.2827,
        lng: -123.1207,
        last_event: Math.floor(Date.now() / 1000) - 1200, // 20 minutes ago
        createdate: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
      },
    }),
  ]);

  console.log(`✅ Created ${players.length} players`);
  return players;
}
