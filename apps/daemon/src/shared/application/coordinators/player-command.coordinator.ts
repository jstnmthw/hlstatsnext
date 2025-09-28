/**
 * Player Command Coordinator
 *
 * Coordinates player command processing by detecting commands in chat events
 * and sending appropriate RCON responses using both PlayerService and RconService.
 * This runs after module handlers have processed the chat event.
 */

import { EventType } from "@/shared/types/events"
import { StructuredCommandBuilder } from "@/modules/rcon/builders/structured-command.builder"
import { CommandResolverService } from "@/modules/rcon/services/command-resolver.service"
import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import type { PlayerChatEvent } from "@/modules/player/types/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IRconService } from "@/modules/rcon/types/rcon.types"

export class PlayerCommandCoordinator implements EventCoordinator {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly rconService: IRconService,
    private readonly commandResolver: CommandResolverService,
    private readonly logger: ILogger,
  ) {}

  async coordinateEvent(event: BaseEvent): Promise<void> {
    // Only handle chat message events
    if (event.eventType !== EventType.CHAT_MESSAGE) {
      return
    }

    const chatEvent = event as PlayerChatEvent
    const { message } = chatEvent.data

    // Only process commands (messages starting with !)
    if (!message.startsWith("!")) {
      return
    }

    this.logger.debug(`Processing player command: ${message}`, {
      playerId: chatEvent.data.playerId,
      serverId: chatEvent.serverId,
      eventData: chatEvent.data,
    })

    try {
      await this.processCommand(chatEvent)
    } catch (error) {
      this.logger.error("Failed to process player command", {
        error: error instanceof Error ? error.message : String(error),
        playerId: chatEvent.data.playerId,
        command: message,
        serverId: chatEvent.serverId,
      })
    }
  }

  private async processCommand(chatEvent: PlayerChatEvent): Promise<void> {
    const { message, playerId } = chatEvent.data
    const { serverId } = chatEvent
    const command = message.slice(1).toLowerCase() // Remove ! and normalize

    // Extract Steam ID from event metadata
    const steamId = ((chatEvent.meta as PlayerMeta)?.steamId as string) || ""
    if (!steamId) {
      this.logger.warn("No Steam ID found in event metadata for command", {
        playerId,
        command,
        serverId,
      })
      return
    }

    // Use target 0 (all players) but plugin will find specific player by Steam ID
    const targetId = 0

    switch (command) {
      case "rank":
        await this.handleRankCommand(playerId, serverId, steamId, targetId)
        break
      case "stats":
        await this.handleStatsCommand(playerId, serverId, steamId, targetId)
        break
      case "session":
        await this.handleSessionCommand(playerId, serverId, steamId, targetId)
        break
      default:
        // Log unknown commands but don't send responses
        this.logger.debug(`Unknown player command: ${command}`, {
          playerId,
          serverId,
        })
    }
  }

  private async handleRankCommand(
    playerId: number,
    serverId: number,
    steamId: string,
    targetId: number,
  ): Promise<void> {
    // Get player rank and total count
    const [rank, totalPlayers, player, commandPrefix] = await Promise.all([
      this.playerRepository.getPlayerRank(playerId),
      this.playerRepository.getTotalPlayerCount(),
      this.playerRepository.getPlayerStats(playerId),
      this.commandResolver.getCommand(serverId, "PlayerEventsCommand"),
    ])

    if (rank === null || !player) {
      this.logger.warn("Could not determine player rank or find player", { playerId, serverId })
      return
    }

    // Send RCON command to display rank
    const rconCommand = StructuredCommandBuilder.buildRankCommand(
      commandPrefix,
      playerId,
      rank,
      totalPlayers,
      player.skill,
      steamId, // Steam ID of requesting player
      targetId, // target all players, plugin will find specific player
    )

    await this.rconService.executeCommand(serverId, rconCommand)
    this.logger.debug(`Sent rank command for player ${playerId}`, {
      rank,
      totalPlayers,
      serverId,
    })
  }

  private async handleStatsCommand(
    playerId: number,
    serverId: number,
    steamId: string,
    targetId: number,
  ): Promise<void> {
    // Get player stats, rank, and total count
    const [player, rank, totalPlayers, commandPrefix] = await Promise.all([
      this.playerRepository.getPlayerStats(playerId),
      this.playerRepository.getPlayerRank(playerId),
      this.playerRepository.getTotalPlayerCount(),
      this.commandResolver.getCommand(serverId, "PlayerEventsCommand"),
    ])

    if (!player || rank === null) {
      this.logger.warn("Could not find player or rank for stats command", { playerId, serverId })
      return
    }

    // Calculate accuracy
    const accuracy = player.shots > 0 ? Math.round((player.hits / player.shots) * 100) : 0

    // Calculate KDR
    const kdr = player.deaths > 0 ? player.kills / player.deaths : player.kills

    // Send RCON command to display stats
    const rconCommand = StructuredCommandBuilder.buildStatsCommand(
      commandPrefix,
      playerId,
      rank,
      totalPlayers,
      player.skill,
      player.kills,
      player.deaths,
      kdr,
      accuracy,
      player.headshots,
      steamId, // Steam ID of requesting player
      targetId, // target all players, plugin will find specific player
    )

    await this.rconService.executeCommand(serverId, rconCommand)
    this.logger.debug(`Sent stats command for player ${playerId}`, {
      kills: player.kills,
      deaths: player.deaths,
      accuracy,
      serverId,
    })
  }

  private async handleSessionCommand(
    playerId: number,
    serverId: number,
    steamId: string,
    targetId: number,
  ): Promise<void> {
    // Get session stats and command prefix
    const [sessionStats, commandPrefix] = await Promise.all([
      this.playerRepository.getPlayerSessionStats(playerId),
      this.commandResolver.getCommand(serverId, "PlayerEventsCommand"),
    ])

    if (!sessionStats) {
      this.logger.warn("Could not find session stats for player", { playerId, serverId })
      return
    }

    // Calculate KDR for session stats
    const sessionKdr =
      sessionStats.deaths > 0 ? sessionStats.kills / sessionStats.deaths : sessionStats.kills

    // Send RCON command to display session stats
    const rconCommand = StructuredCommandBuilder.buildSessionCommand(
      commandPrefix,
      playerId,
      sessionStats.kills,
      sessionStats.deaths,
      sessionKdr,
      sessionStats.sessionTime,
      steamId, // Steam ID of requesting player
      targetId, // target all players, plugin will find specific player
    )

    await this.rconService.executeCommand(serverId, rconCommand)
    this.logger.debug(`Sent session command for player ${playerId}`, {
      kills: sessionStats.kills,
      deaths: sessionStats.deaths,
      sessionTime: sessionStats.sessionTime,
      serverId,
    })
  }
}
