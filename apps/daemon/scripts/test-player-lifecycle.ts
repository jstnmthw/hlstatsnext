#!/usr/bin/env tsx

/**
 * Integration test for complete player lifecycle
 * Tests: connect, kill, suicide, teamkill, disconnect events
 *
 * Usage: pnpm tsx scripts/test-player-lifecycle.ts
 */

import { DatabaseClient } from "../src/database/client"
import { createEventProcessorService } from "../src/services/processor/processor.service"
import { PlayerService } from "../src/services/player/player.service"
import { logger } from "../src/utils/logger"
import {
  EventType,
  type PlayerConnectEvent,
  type PlayerKillEvent,
  type PlayerSuicideEvent,
  type PlayerTeamkillEvent,
  type PlayerDisconnectEvent,
  type PlayerMeta,
} from "../src/types/common/events"

async function testPlayerLifecycle() {
  const db = new DatabaseClient()
  const processor = createEventProcessorService(db, logger, { logBots: true }) // Include bots in testing
  const playerService = new PlayerService(db, logger)

  try {
    console.log("🧪 Testing Player Lifecycle...\n")

    // Test 1: Player Connect
    console.log("1️⃣ Testing PLAYER_CONNECT...")
    const connectEvent: PlayerConnectEvent & { meta: PlayerMeta } = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp: new Date(),
      serverId: 1,
      data: {
        playerId: 0,
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        ipAddress: "192.168.1.100",
      },
      meta: {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      },
    }
    await processor.processEvent(connectEvent)
    console.log("✅ Player connected successfully\n")

    // Test 2: Player Kill
    console.log("2️⃣ Testing PLAYER_KILL...")
    const killEvent: PlayerKillEvent & { meta?: unknown } = {
      eventType: EventType.PLAYER_KILL,
      timestamp: new Date(),
      serverId: 1,
      data: {
        killerId: 0,
        victimId: 0,
        weapon: "ak47",
        headshot: true,
        killerTeam: "TERRORIST",
        victimTeam: "CT",
      },
      meta: {
        killer: {
          steamId: "STEAM_1:0:111",
          playerName: "Killer",
          isBot: false,
        },
        victim: {
          steamId: "STEAM_1:0:222",
          playerName: "Victim",
          isBot: false,
        },
      },
    }
    await processor.processEvent(killEvent)
    console.log("✅ Kill event processed\n")

    // Test 3: Player Suicide
    console.log("3️⃣ Testing PLAYER_SUICIDE...")
    const suicideEvent: PlayerSuicideEvent & { meta: PlayerMeta } = {
      eventType: EventType.PLAYER_SUICIDE,
      timestamp: new Date(),
      serverId: 1,
      data: {
        playerId: 0,
        weapon: "world",
        team: "TERRORIST",
      },
      meta: {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      },
    }
    await processor.processEvent(suicideEvent)
    console.log("✅ Suicide event processed\n")

    // Test 4: Player Teamkill
    console.log("4️⃣ Testing PLAYER_TEAMKILL...")
    const teamkillEvent: PlayerTeamkillEvent & { meta?: unknown } = {
      eventType: EventType.PLAYER_TEAMKILL,
      timestamp: new Date(),
      serverId: 1,
      data: {
        killerId: 0,
        victimId: 0,
        weapon: "m4a1",
        headshot: false,
        team: "CT",
      },
      meta: {
        killer: {
          steamId: "STEAM_1:0:111",
          playerName: "Killer",
          isBot: false,
        },
        victim: {
          steamId: "STEAM_1:0:222",
          playerName: "Victim",
          isBot: false,
        },
      },
    }
    await processor.processEvent(teamkillEvent)
    console.log("✅ Teamkill event processed\n")

    // Test 5: Bot Events
    console.log("5️⃣ Testing BOT events...")
    const botKillEvent: PlayerKillEvent & { meta?: unknown } = {
      eventType: EventType.PLAYER_KILL,
      timestamp: new Date(),
      serverId: 1,
      data: {
        killerId: 0,
        victimId: 0,
        weapon: "deagle",
        headshot: true,
        killerTeam: "CT",
        victimTeam: "TERRORIST",
      },
      meta: {
        killer: {
          steamId: "BOT",
          playerName: "Bot_Frank",
          isBot: true,
        },
        victim: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        },
      },
    }
    await processor.processEvent(botKillEvent)
    console.log("✅ Bot kill event processed\n")

    // Test 6: Player Disconnect
    console.log("6️⃣ Testing PLAYER_DISCONNECT...")
    const disconnectEvent: PlayerDisconnectEvent = {
      eventType: EventType.PLAYER_DISCONNECT,
      timestamp: new Date(),
      serverId: 1,
      data: {
        playerId: 1, // Will be resolved
        reason: "Disconnect by user",
        sessionDuration: 3600, // 1 hour
      },
    }
    await processor.processEvent(disconnectEvent)
    console.log("✅ Player disconnected\n")

    // Display final stats
    console.log("📊 Final Player Statistics:")
    console.log("=".repeat(60))

    const player1 = await playerService.getPlayerStats(1)

    if (player1) {
      console.log(`Player: ${player1.lastName}`)
      console.log(`  Skill: ${player1.skill}`)
      console.log(`  Kills: ${player1.kills}`)
      console.log(`  Deaths: ${player1.deaths}`)
      console.log(`  Suicides: ${player1.suicides}`)
      console.log(`  Teamkills: ${player1.teamkills}`)
      console.log(`  Headshots: ${player1.headshots}`)
      console.log(`  K/D Ratio: ${player1.deaths > 0 ? (player1.kills / player1.deaths).toFixed(2) : player1.kills}`)
      console.log()
    }

    // Query and display top rankings
    console.log("\n🏆 Top 10 Players by Skill:")
    console.log("=".repeat(60))
    const topPlayers = await processor.getTopPlayers(10, "cstrike", true)
    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.lastName.padEnd(20)} - Skill: ${player.skill}`)
    })

    console.log("\n✅ All tests completed successfully!")
  } catch (error) {
    console.error("❌ Test failed:", error)
    process.exit(1)
  } finally {
    await processor.disconnect()
    console.log("\n👋 Cleanup complete")
  }
}

// Run the test
testPlayerLifecycle().catch(console.error)
