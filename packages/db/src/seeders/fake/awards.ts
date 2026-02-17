import { faker } from "@faker-js/faker"
import { db, Prisma } from "../../client"
import { getSeedConfig } from "./config"
import { log } from "./logger"

export async function seedAwards() {
  const config = getSeedConfig()
  const games = await db.game.findMany()
  if (games.length === 0) {
    throw new Error("No games found to associate awards with.")
  }

  const awards: Prisma.AwardCreateManyInput[] = []
  for (const game of games) {
    for (let i = 0; i < config.awards.count; i++) {
      const award: Prisma.AwardCreateManyInput = {
        game: game.code,
        code: faker.lorem.slug(3),
        name: faker.lorem.words(3),
        verb: faker.lorem.sentence(),
      }
      awards.push(award)
    }
  }

  const result = await db.award.createMany({
    data: awards,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} awards.`)
}
