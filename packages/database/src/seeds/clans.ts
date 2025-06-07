import { db } from "..";
import { getSeedConfig } from "./config";
import { generateClanData } from "./utils";
import { log } from "./logger";

export async function seedClans() {
  const config = getSeedConfig();
  const games = await db.game.findMany();

  if (games.length === 0) {
    throw new Error("No games found to associate clans with.");
  }

  const clans = [];
  for (const game of games) {
    for (let i = 0; i < config.clans.count; i++) {
      const clanData = generateClanData();
      const clan = {
        ...clanData,
        game: game.code,
      };
      clans.push(clan);
    }
  }

  const result = await db.clan.createMany({
    data: clans,
    skipDuplicates: true,
  });

  log(`✚ Created ${result.count} clans.`);
}
