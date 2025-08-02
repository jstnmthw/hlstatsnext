import { faker } from "@faker-js/faker"
import type { Prisma } from "../../client"

// Type for game statistics
export type GameStats = Pick<
  Prisma.PlayerCreateInput,
  "skill" | "kills" | "deaths" | "headshots" | "shots" | "hits" | "connectionTime"
>

/**
 * Generate game-specific statistics based on game type
 */
export function generateGameStats(gameCode: string): GameStats {
  switch (gameCode) {
    case "css": // Counter-Strike: Source
      return generateCSSourceStats()
    case "tf": // Team Fortress 2
      return generateTF2Stats()
    case "tfc": // Team Fortress Classic
      return generateTFCStats()
    default:
      return generateDefaultStats()
  }
}

function generateCSSourceStats(): GameStats {
  const skill = faker.number.int({ min: 800, max: 2000 })
  const kills = faker.number.int({ min: 100, max: 5000 })
  const kdRatio = faker.number.float({ min: 0.8, max: 2.5 })
  const deaths = Math.round(kills / kdRatio)

  // CS players typically have higher headshot rates
  const headshotRate = faker.number.float({ min: 0.15, max: 0.45 })
  const headshots = Math.round(kills * headshotRate)

  // Accuracy for CS
  const accuracy = faker.number.float({ min: 0.25, max: 0.55 })
  const shots = Math.round((kills / accuracy) * 2)
  const hits = Math.round(shots * accuracy)

  const connectionTime = faker.number.int({ min: 3600, max: 500000 })

  return { skill, kills, deaths, headshots, shots, hits, connectionTime }
}

function generateTF2Stats(): GameStats {
  const skill = faker.number.int({ min: 900, max: 1600 })
  const kills = faker.number.int({ min: 80, max: 4000 })
  const kdRatio = faker.number.float({ min: 0.9, max: 2.0 })
  const deaths = Math.round(kills / kdRatio)

  // TF2 has lower headshot rates due to class variety
  const headshotRate = faker.number.float({ min: 0.05, max: 0.25 })
  const headshots = Math.round(kills * headshotRate)

  const accuracy = faker.number.float({ min: 0.2, max: 0.5 })
  const shots = Math.round((kills / accuracy) * 1.8)
  const hits = Math.round(shots * accuracy)

  const connectionTime = faker.number.int({ min: 2400, max: 400000 })

  return { skill, kills, deaths, headshots, shots, hits, connectionTime }
}

function generateTFCStats(): GameStats {
  const skill = faker.number.int({ min: 950, max: 1700 })
  const kills = faker.number.int({ min: 90, max: 3500 })
  const kdRatio = faker.number.float({ min: 0.8, max: 2.1 })
  const deaths = Math.round(kills / kdRatio)

  const headshotRate = faker.number.float({ min: 0.08, max: 0.3 })
  const headshots = Math.round(kills * headshotRate)

  const accuracy = faker.number.float({ min: 0.22, max: 0.52 })
  const shots = Math.round((kills / accuracy) * 1.9)
  const hits = Math.round(shots * accuracy)

  const connectionTime = faker.number.int({ min: 1800, max: 350000 })

  return { skill, kills, deaths, headshots, shots, hits, connectionTime }
}

function generateDefaultStats(): GameStats {
  const skill = faker.number.int({ min: 800, max: 1800 })
  const kills = faker.number.int({ min: 50, max: 3000 })
  const kdRatio = faker.number.float({ min: 0.7, max: 2.2 })
  const deaths = Math.round(kills / kdRatio)

  const headshotRate = faker.number.float({ min: 0.1, max: 0.35 })
  const headshots = Math.round(kills * headshotRate)

  const accuracy = faker.number.float({ min: 0.18, max: 0.48 })
  const shots = Math.round((kills / accuracy) * 2.2)
  const hits = Math.round(shots * accuracy)

  const connectionTime = faker.number.int({ min: 1200, max: 300000 })

  return { skill, kills, deaths, headshots, shots, hits, connectionTime }
}

// Type for clan data
type ClanData = Pick<Prisma.ClanCreateInput, "tag" | "name" | "homepage" | "mapregion">

/**
 * Generate realistic clan data
 */
export function generateClanData(): ClanData {
  // Generate unique tag with random word + number to avoid duplicates
  const word = faker.lorem.word({ length: { min: 2, max: 4 } }).toUpperCase()
  const number = faker.number.int({ min: 1, max: 999 })
  const tag = `[${word}${number}]`

  const name = faker.company.name()
  const homepage = faker.datatype.boolean(0.4) ? faker.internet.url() : undefined
  const mapregion = faker.location.country()

  return { tag, name, homepage, mapregion }
}

// Type for player data
type PlayerData = Pick<
  Prisma.PlayerCreateInput,
  "lastName" | "fullName" | "email" | "city" | "state" | "lat" | "lng" | "lastEvent" | "createdAt"
>

/**
 * Generate realistic player data
 */
export function generatePlayerData(): PlayerData {
  const lastName = faker.internet.username()
  const fullName = faker.person.fullName()
  const email = faker.datatype.boolean(0.7) ? faker.internet.email() : undefined
  const homepage = faker.datatype.boolean(0.3) ? faker.internet.url() : undefined

  const city = faker.location.city()
  const state = faker.location.state()
  const lat = faker.location.latitude()
  const lng = faker.location.longitude()

  // Player creation date (within last 2 years)
  const createdAt = faker.date.past({ years: 2 })

  // Last event (between creation and now)
  const lastEvent = faker.date.between({
    from: createdAt,
    to: new Date(),
  })

  return {
    lastName,
    fullName,
    email,
    city,
    state,
    lat,
    lng,
    lastEvent,
    createdAt,
  }
}

/**
 * Generate valid Steam ID
 */
export function generateSteamId(): string {
  const universe = 0 // Public universe
  const accountType = faker.datatype.boolean() ? 0 : 1 // Even/odd
  const accountId = faker.number.int({ min: 1, max: 999999999 })

  return `STEAM_${universe}:${accountType}:${accountId}`
}
