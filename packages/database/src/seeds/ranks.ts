import { db } from "../client"
import { getSeedConfig } from "./config"
import { log } from "./logger"
import { faker } from "@faker-js/faker"

export async function seedRanks() {
  const config = getSeedConfig()
  const games = await db.game.findMany()
  if (games.length === 0) {
    throw new Error("No games found to associate ranks with.")
  }

  const ranks = []
  for (const game of games) {
    let minKills = 0
    for (let i = 0; i < config.ranks.count; i++) {
      const maxKills = minKills + faker.number.int({ min: 50, max: 200 })
      const rank = {
        game: game.code,
        image: `rank_${i}`,
        minKills: minKills,
        maxKills: maxKills,
        rankName: faker.lorem.word(),
      }
      ranks.push(rank)
      minKills = maxKills + 1
    }
  }

  const result = await db.rank.createMany({
    data: ranks,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} ranks.`)
}
