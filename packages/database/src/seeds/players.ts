import { faker } from "@faker-js/faker";
import { db } from "../index";
import { getSeedConfig } from "./config";
import { generatePlayerData, generateGameStats } from "./utils";

export async function seedPlayers() {
  console.log("👥 Seeding players...");

  const config = getSeedConfig();
  const { count, clanDistribution, gamesDistribution } = config.players;

  // Get available games
  const availableGames = await db.game.findMany({
    where: { hidden: "0" },
    select: { code: true, name: true },
  });

  if (availableGames.length === 0) {
    throw new Error(
      "Required games not found. Please ensure Games are seeded first."
    );
  }

  // Get available countries
  const availableCountries = await db.country.findMany({
    select: { flag: true, name: true },
  });

  // Get existing clans
  const availableClans = await db.clan.findMany({
    select: { clanId: true, tag: true, game: true },
  });

  console.log(
    `📊 Creating ${count} players with ${availableClans.length} clans available`
  );

  const gameDistribution = gamesDistribution || {};
  const clanDist = clanDistribution || { withClan: 0.7, withoutClan: 0.3 };

  // Calculate how many players should have clans
  const playersWithClan = Math.round(count * clanDist.withClan);
  const playersWithoutClan = count - playersWithClan;

  console.log(
    `🔗 ${playersWithClan} players will have clans, ${playersWithoutClan} will be solo`
  );

  // Create players in batches
  const batchSize = 100;
  const players = [];

  for (let i = 0; i < count; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, count);
    const batchPlayers = [];

    for (let j = i; j < batchEnd; j++) {
      // Select game based on distribution or randomly
      let selectedGame: string;
      if (Object.keys(gameDistribution).length > 0) {
        const gameCodes = availableGames.map((g) => g.code);
        const weights = gameCodes.map((code) => gameDistribution[code] || 0.1);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = faker.number.float({ min: 0, max: totalWeight });

        selectedGame = gameCodes[0] || "css"; // fallback
        for (let k = 0; k < gameCodes.length; k++) {
          random -= weights[k]!;
          if (random <= 0) {
            selectedGame = gameCodes[k]!;
            break;
          }
        }
      } else {
        const gameCodes = availableGames.map((g) => g.code);
        selectedGame = gameCodes[0] || "css"; // fallback if no games
      }

      // Determine if player should have a clan
      const shouldHaveClan = j < playersWithClan;
      let selectedClan = 0; // 0 means no clan

      if (shouldHaveClan && availableClans.length > 0) {
        // Try to find a clan for the selected game first
        const gameClans = availableClans.filter(
          (clan) => clan.game === selectedGame
        );
        if (gameClans.length > 0) {
          const randomClan = faker.helpers.arrayElement(gameClans);
          selectedClan = randomClan.clanId;
        } else {
          // If no clans for this game, pick any clan
          const randomClan = faker.helpers.arrayElement(availableClans);
          selectedClan = randomClan.clanId;
        }
      }

      // Generate player data
      const playerData = generatePlayerData();
      const gameStats = generateGameStats(selectedGame);

      // Select random country
      const selectedCountry =
        availableCountries.length > 0
          ? faker.helpers.arrayElement(availableCountries)
          : { flag: "US", name: "United States" };

      batchPlayers.push(
        db.player.upsert({
          where: { playerId: j + 1 },
          update: {},
          create: {
            lastName: playerData.lastName,
            fullName: playerData.fullName,
            email: playerData.email,
            homepage: playerData.homepage,
            game: selectedGame,
            flag: selectedCountry.flag,
            clan: selectedClan,
            skill: gameStats.skill,
            kills: gameStats.kills,
            deaths: gameStats.deaths,
            headshots: gameStats.headshots,
            shots: gameStats.shots,
            hits: gameStats.hits,
            connection_time: gameStats.connection_time,
            city: playerData.city,
            state: playerData.state,
            country: selectedCountry.name,
            lat: playerData.lat,
            lng: playerData.lng,
            last_event: playerData.last_event,
            createdate: playerData.createdate,
          },
        })
      );
    }

    const batchResults = await Promise.all(batchPlayers);
    players.push(...batchResults);

    if (batchEnd < count) {
      console.log(`⚡ Created ${batchEnd}/${count} players...`);
    }
  }

  console.log(`✅ Created ${players.length} players`);

  // Log distribution stats
  const gameStats = new Map<string, number>();
  const clanStats = { withClan: 0, withoutClan: 0 };

  for (const player of players) {
    // Game distribution
    const currentCount = gameStats.get(player.game) || 0;
    gameStats.set(player.game, currentCount + 1);

    // Clan distribution
    if (player.clan > 0) {
      clanStats.withClan++;
    } else {
      clanStats.withoutClan++;
    }
  }

  console.log("📈 Player distribution by game:");
  for (const [game, playerCount] of gameStats.entries()) {
    const gameName = availableGames.find((g) => g.code === game)?.name || game;
    const percentage = Math.round((playerCount / players.length) * 100);
    console.log(
      `   ${game} (${gameName}): ${playerCount} players (${percentage}%)`
    );
  }

  console.log("🏰 Clan membership distribution:");
  const clanPercentage = Math.round(
    (clanStats.withClan / players.length) * 100
  );
  const soloPercentage = Math.round(
    (clanStats.withoutClan / players.length) * 100
  );
  console.log(
    `   With clan: ${clanStats.withClan} players (${clanPercentage}%)`
  );
  console.log(`   Solo: ${clanStats.withoutClan} players (${soloPercentage}%)`);

  return players;
}
