import { db, Prisma } from "../../client"
import { getSeedConfig } from "./config"
import { log } from "./logger"
import { faker } from "@faker-js/faker"

export async function seedWeapons() {
  const config = getSeedConfig()
  const games = await db.game.findMany()

  if (games.length === 0) {
    throw new Error("No games found to associate weapons with.")
  }

  const weapons: Prisma.WeaponCreateManyInput[] = []
  for (const game of games) {
    for (let i = 0; i < config.weapons.count; i++) {
      const weapon: Prisma.WeaponCreateManyInput = {
        name: faker.lorem.words(1),
        code: faker.lorem.slug(1),
        game: game.code,
        modifier: faker.number.float({ min: 0.5, max: 2.5 }),
      }
      weapons.push(weapon)
    }
  }

  const result = await db.weapon.createMany({
    data: weapons,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} weapons.`)
}
