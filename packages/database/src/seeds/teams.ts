import { db } from "../client"
import { getSeedConfig } from "./config"
import { log } from "./logger"
import { faker } from "@faker-js/faker"

export async function seedTeams() {
  const config = getSeedConfig()
  const games = await db.game.findMany()

  if (games.length === 0) {
    throw new Error("No games found to associate teams with.")
  }

  const teams = []
  for (const game of games) {
    for (let i = 0; i < config.teams.count; i++) {
      const team = {
        name: faker.lorem.words(2),
        game: game.code,
        code: faker.lorem.word(),
      }
      teams.push(team)
    }
  }

  const result = await db.team.createMany({
    data: teams,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} teams.`)
}
