#!/usr/bin/env tsx

/**
 * Test script to verify player ranking query functionality
 *
 * Usage: pnpm tsx scripts/test-player-ranking.ts
 */

import { DatabaseClient } from "../src/database/client"
import { PlayerService } from "../src/services/player/player.service"
import { logger } from "../src/utils/logger"

async function testPlayerRanking() {
  const db = new DatabaseClient()
  const playerService = new PlayerService(db, logger)

  try {
    console.log("Testing database connection...")
    const connected = await db.testConnection()
    if (!connected) {
      throw new Error("Failed to connect to database")
    }
    console.log("✅ Database connected successfully\n")

    // Query top 50 players by ranking
    console.log("Querying top 50 players by skill ranking...")
    const topPlayers = await playerService.getTopPlayers(50, "cstrike", true) // Include hidden players for testing

    if (topPlayers.length === 0) {
      console.log("No players found in database. Creating test data...")

      // Create some test players
      const testPlayers = [
        { name: "Pro_Player_1", steamId: "STEAM_1:0:11111", skill: 1500 },
        { name: "Pro_Player_2", steamId: "STEAM_1:0:22222", skill: 1400 },
        { name: "Average_Joe", steamId: "STEAM_1:0:33333", skill: 1000 },
        { name: "Newbie", steamId: "STEAM_1:0:44444", skill: 800 },
        { name: "Bot_1", steamId: "BOT", skill: 1200 },
      ]

      for (const player of testPlayers) {
        const playerId = await playerService.getOrCreatePlayer(player.steamId, player.name, "cstrike")
        await playerService.updatePlayerStats(playerId, { skill: player.skill })
        console.log(`Created player: ${player.name} (ID: ${playerId}, Skill: ${player.skill})`)
      }

      // Query again
      const newTopPlayers = await playerService.getTopPlayers(50, "cstrike", true)
      displayRankings(newTopPlayers)
    } else {
      displayRankings(topPlayers)
    }

    // Test filtering by game
    console.log("\nTesting game filtering...")
    const csPlayers = await playerService.getTopPlayers(10, "cstrike", false)
    console.log(`Found ${csPlayers.length} Counter-Strike players (excluding hidden)`)
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await db.disconnect()
    console.log("\n✅ Database connection closed")
  }
}

function displayRankings(
  players: Array<{
    playerId: number
    lastName: string
    skill: number
    kills: number
    deaths: number
    headshots: number
  }>,
) {
  console.log("\n🏆 TOP PLAYER RANKINGS 🏆")
  console.log("=".repeat(80))
  console.log("Rank | Player ID | Name                    | Skill | K/D    | Headshots")
  console.log("-".repeat(80))

  players.slice(0, 50).forEach((player, index) => {
    const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toFixed(2)
    console.log(
      `${String(index + 1).padStart(4)} | ` +
        `${String(player.playerId).padStart(9)} | ` +
        `${player.lastName.padEnd(23)} | ` +
        `${String(player.skill).padStart(5)} | ` +
        `${kd.padStart(6)} | ` +
        `${String(player.headshots).padStart(9)}`,
    )
  })

  console.log("=".repeat(80))
  console.log(`Total players shown: ${players.length}`)
}

// Run the test
testPlayerRanking().catch(console.error)
