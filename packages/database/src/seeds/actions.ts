import { db } from "..";
import { getSeedConfig } from "./config";
import { log } from "./logger";
import { faker } from "@faker-js/faker";

export async function seedActions() {
  const config = getSeedConfig();
  const games = await db.game.findMany();

  if (games.length === 0) {
    throw new Error("No games found to associate actions with.");
  }

  const actions = [];
  for (const game of games) {
    for (let i = 0; i < config.actions.count; i++) {
      const action = {
        game: game.code,
        code: faker.lorem.slug(2),
        reward_player: faker.number.int({ min: -10, max: 25 }),
        reward_team: faker.number.int({ min: 0, max: 10 }),
        team: "",
      };
      actions.push(action);
    }
  }

  const result = await db.action.createMany({
    data: actions,
    skipDuplicates: true,
  });

  log(`✔ Created ${result.count} actions.`);
}
