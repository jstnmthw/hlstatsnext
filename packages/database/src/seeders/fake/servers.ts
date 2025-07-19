import { db, Prisma } from "../../client"
import { getSeedConfig } from "./config"
import { log } from "./logger"
import { faker } from "@faker-js/faker"

export async function seedServers() {
  const config = getSeedConfig()
  const games = await db.game.findMany()

  if (games.length === 0) {
    throw new Error("No games found to associate servers with.")
  }

  const servers: Prisma.ServerCreateManyInput[] = []
  for (let i = 0; i < config.servers.count; i++) {
    const game = faker.helpers.arrayElement(games)
    const server: Prisma.ServerCreateManyInput = {
      name: `${faker.word.adjective()} ${faker.word.noun()} Server`,
      address: faker.internet.ip(),
      port: faker.number.int({ min: 10000, max: 65535 }),
      game: game.code,
      city: faker.location.city(),
      country: faker.location.countryCode(),
    }
    servers.push(server)
  }

  const result = await db.server.createMany({
    data: servers,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} servers.`)
}
