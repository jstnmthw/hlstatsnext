/**
 * Structured Command Builder
 *
 * Builds structured commands for the HLStatsNext AMX plugin.
 * Commands follow the format: <commandPrefix> <target> <EVENT_TYPE> <DATA...>
 * Command prefixes are resolved from database configuration (e.g., hlx_event, amx_psay, etc.)
 */

import type {
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
  TeamActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
} from "../types/notification.types"

export class StructuredCommandBuilder {
  /**
   * Escape strings for safe transmission in commands
   */
  private static escapeString(value: string | undefined): string {
    if (!value) return '""'
    // Escape quotes and wrap in quotes
    return `"${value.replace(/"/g, '\\"')}"`
  }

  /**
   * Build command for kill event
   */
  static buildKillCommand(
    commandPrefix: string,
    data: KillEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "KILL",
      data.killerId.toString(),
      this.escapeString(data.killerName),
      (data.killerSkill || 0).toString(),
      data.victimId.toString(),
      this.escapeString(data.victimName),
      (data.victimSkill || 0).toString(),
      data.skillAdjustment.killerChange.toString(),
      data.weapon || "unknown",
      data.headshot ? "1" : "0",
    ]
    return parts.join(" ")
  }

  /**
   * Build command for suicide event
   */
  static buildSuicideCommand(
    commandPrefix: string,
    data: SuicideEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "SUICIDE",
      data.playerId.toString(),
      this.escapeString(data.playerName),
      (data.playerSkill || 0).toString(),
      data.skillPenalty.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for teamkill event
   */
  static buildTeamKillCommand(
    commandPrefix: string,
    data: TeamKillEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "TEAMKILL",
      data.killerId.toString(),
      this.escapeString(data.killerName),
      data.victimId.toString(),
      this.escapeString(data.victimName),
      data.skillPenalty.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for action event
   */
  static buildActionCommand(
    commandPrefix: string,
    data: ActionEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "ACTION",
      data.playerId.toString(),
      this.escapeString(data.playerName),
      (data.playerSkill || 0).toString(),
      this.escapeString(data.actionCode),
      this.escapeString(data.actionDescription),
      data.points.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for team action event
   */
  static buildTeamActionCommand(
    commandPrefix: string,
    data: TeamActionEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "TEAM_ACTION",
      this.escapeString(data.team),
      this.escapeString(data.actionCode),
      this.escapeString(data.actionDescription),
      data.points.toString(),
      (data.playerCount || 0).toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for connect event
   */
  static buildConnectCommand(
    commandPrefix: string,
    data: ConnectEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "CONNECT",
      data.playerId.toString(),
      this.escapeString(data.playerName),
      this.escapeString(data.playerCountry),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for disconnect event
   */
  static buildDisconnectCommand(
    commandPrefix: string,
    data: DisconnectEventNotificationData,
    target: number = 0,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "DISCONNECT",
      data.playerId.toString(),
      this.escapeString(data.playerName),
      data.sessionDuration.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for rank response (to !rank command)
   */
  static buildRankCommand(
    commandPrefix: string,
    playerId: number,
    rank: number,
    totalPlayers: number,
    skill: number,
    steamId: string,
    target: number,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "RANK",
      this.escapeString(steamId),
      playerId.toString(),
      rank.toString(),
      totalPlayers.toString(),
      skill.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for stats response (to !stats command)
   */
  static buildStatsCommand(
    commandPrefix: string,
    playerId: number,
    rank: number,
    total: number,
    skill: number,
    kills: number,
    deaths: number,
    kdr: number,
    accuracy: number,
    headshots: number,
    steamId: string,
    target: number,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "STATS",
      this.escapeString(steamId),
      playerId.toString(),
      rank.toString(),
      total.toString(),
      skill.toString(),
      kills.toString(),
      deaths.toString(),
      kdr.toFixed(2),
      accuracy.toString(),
      headshots.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build command for session response (to !session command)
   */
  static buildSessionCommand(
    commandPrefix: string,
    playerId: number,
    sessionKills: number,
    sessionDeaths: number,
    sessionKdr: number,
    sessionTime: number,
    steamId: string,
    target: number,
  ): string {
    const parts = [
      commandPrefix,
      target.toString(),
      "SESSION",
      this.escapeString(steamId),
      playerId.toString(),
      sessionKills.toString(),
      sessionDeaths.toString(),
      sessionKdr.toFixed(2),
      sessionTime.toString(),
    ]
    return parts.join(" ")
  }

  /**
   * Build a generic message command (fallback)
   */
  static buildMessageCommand(commandPrefix: string, message: string, target: number = 0): string {
    const parts = [commandPrefix, target.toString(), "MESSAGE", this.escapeString(message)]
    return parts.join(" ")
  }

  /**
   * Build announcement command (public message to all)
   */
  static buildAnnouncementCommand(commandPrefix: string, message: string): string {
    return `${commandPrefix} ${message}`
  }
}
