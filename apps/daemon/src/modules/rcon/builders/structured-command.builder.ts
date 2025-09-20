/**
 * Structured Command Builder
 *
 * Builds structured commands for the HLStatsNext AMX plugin.
 * Commands follow the format: hlx_event <target> <EVENT_TYPE> <DATA...>
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
  static buildKillCommand(data: KillEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildSuicideCommand(data: SuicideEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildTeamKillCommand(data: TeamKillEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildActionCommand(data: ActionEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildTeamActionCommand(data: TeamActionEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildConnectCommand(data: ConnectEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
  static buildDisconnectCommand(data: DisconnectEventNotificationData, target: number = 0): string {
    const parts = [
      "hlx_event",
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
    playerId: number,
    rank: number,
    totalPlayers: number,
    skill: number,
    target: number,
  ): string {
    const parts = [
      "hlx_event",
      target.toString(),
      "RANK",
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
    playerId: number,
    rank: number,
    total: number,
    skill: number,
    kills: number,
    deaths: number,
    kdr: number,
    accuracy: number,
    headshots: number,
    target: number,
  ): string {
    const parts = [
      "hlx_event",
      target.toString(),
      "STATS",
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
   * Build a generic message command (fallback)
   */
  static buildMessageCommand(message: string, target: number = 0): string {
    const parts = ["hlx_event", target.toString(), "MESSAGE", this.escapeString(message)]
    return parts.join(" ")
  }

  /**
   * Build announcement command (public message to all)
   */
  static buildAnnouncementCommand(message: string): string {
    return `hlx_announce ${message}`
  }
}
