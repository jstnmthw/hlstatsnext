import { db, Prisma } from "../../client"
import { log, logWarning } from "./logger"

const games: Prisma.GameCreateManyInput[] = [
  {
    code: "tf",
    name: "Team Fortress 2",
    realgame: "tf",
  },
  {
    code: "csgo",
    name: "Counter-Strike: Global Offensive",
    realgame: "csgo",
  },
  {
    code: "css",
    name: "Counter-Strike: Source",
    realgame: "css",
  },
  {
    code: "dod",
    name: "Day of Defeat: Source",
    realgame: "dods",
  },
  {
    code: "hl2dm",
    name: "Half-Life 2: Deathmatch",
    realgame: "hl2mp",
  },
]

export async function seedGames() {
  const existingCount = await db.game.count()
  if (existingCount > 0) {
    logWarning("Games already exist, skipping seed.")
    return
  }

  const result = await db.game.createMany({
    data: games,
    skipDuplicates: true,
  })

  log(`✔ Created ${result.count} games.`)
}
