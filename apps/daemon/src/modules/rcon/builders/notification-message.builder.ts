/**
 * Notification Message Builder
 *
 * Builds formatted notification messages using the builder pattern.
 * Supports different event types, color formatting, and template customization.
 */

import { EventType } from "@/shared/types/events"
import type { IColorFormatter } from "../formatters/color-formatter.interface"
import type {
  MessageComponents,
  MessageTemplates,
  TemplateContext,
  NotificationEventData,
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
  TeamActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
} from "../types/notification.types"
import { DEFAULT_MESSAGE_TEMPLATES } from "../types/notification.types"

export class NotificationMessageBuilder {
  private components: MessageComponents = {} as MessageComponents
  private templates: MessageTemplates = DEFAULT_MESSAGE_TEMPLATES
  private colorFormatter?: IColorFormatter

  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.components = {} as MessageComponents
    return this
  }

  /**
   * Set the color formatter to use for text formatting
   */
  withColorFormatter(formatter: IColorFormatter): this {
    this.colorFormatter = formatter
    return this
  }

  /**
   * Set custom message templates
   */
  withTemplates(templates: Partial<MessageTemplates>): this {
    this.templates = { ...DEFAULT_MESSAGE_TEMPLATES, ...templates }
    return this
  }

  /**
   * Set the event type
   */
  withEventType(eventType: EventType): this {
    this.components.eventType = eventType
    return this
  }

  /**
   * Set killer information
   */
  withKiller(id: number, name?: string, rank?: number): this {
    this.components.killer = { id, name, rank }
    return this
  }

  /**
   * Set victim information
   */
  withVictim(id: number, name?: string, rank?: number): this {
    this.components.victim = { id, name, rank }
    return this
  }

  /**
   * Set player information (for single-player events)
   */
  withPlayer(id: number, name?: string, rank?: number): this {
    this.components.player = { id, name, rank }
    return this
  }

  /**
   * Set team information
   */
  withTeam(team: string): this {
    this.components.team = team
    return this
  }

  /**
   * Set action information
   */
  withAction(code: string, description: string): this {
    this.components.action = { code, description }
    return this
  }

  /**
   * Set points value
   */
  withPoints(points: number): this {
    this.components.points = points
    return this
  }

  /**
   * Set weapon information
   */
  withWeapon(weapon: string): this {
    this.components.weapon = weapon
    return this
  }

  /**
   * Set headshot flag
   */
  withHeadshot(headshot: boolean): this {
    this.components.headshot = headshot
    return this
  }

  /**
   * Set skill adjustment information
   */
  withSkillAdjustment(killerChange: number, victimChange: number): this {
    this.components.skillAdjustment = { killerChange, victimChange }
    return this
  }

  /**
   * Set skill penalty
   */
  withSkillPenalty(penalty: number): this {
    this.components.skillPenalty = penalty
    return this
  }

  /**
   * Set player count (for team events)
   */
  withPlayerCount(count: number): this {
    this.components.playerCount = count
    return this
  }

  /**
   * Set connection time
   */
  withConnectionTime(time: number): this {
    this.components.connectionTime = time
    return this
  }

  /**
   * Build message from notification event data (convenience method)
   */
  fromEventData(data: NotificationEventData): this {
    const eventType = this.inferEventType(data)
    switch (eventType) {
      case "kill":
        return this.fromKillEvent(data as KillEventNotificationData)
      case "suicide":
        return this.fromSuicideEvent(data as SuicideEventNotificationData)
      case "teamkill":
        return this.fromTeamKillEvent(data as TeamKillEventNotificationData)
      case "action":
        return this.fromActionEvent(data as ActionEventNotificationData)
      case "teamAction":
        return this.fromTeamActionEvent(data as TeamActionEventNotificationData)
      case "connect":
        return this.fromConnectEvent(data as ConnectEventNotificationData)
      case "disconnect":
        return this.fromDisconnectEvent(data as DisconnectEventNotificationData)
      default:
        throw new Error(`Unsupported event type: ${eventType || "unknown"}`)
    }
  }

  /**
   * Build message from kill event data
   */
  fromKillEvent(data: KillEventNotificationData): this {
    return this.withEventType(EventType.PLAYER_KILL)
      .withKiller(data.killerId, data.killerName, data.killerRank)
      .withVictim(data.victimId, data.victimName, data.victimRank)
      .withPoints(data.skillAdjustment.killerChange)
      .withSkillAdjustment(data.skillAdjustment.killerChange, data.skillAdjustment.victimChange)
      .withWeapon(data.weapon || "")
      .withHeadshot(data.headshot || false)
  }

  /**
   * Build message from suicide event data
   */
  fromSuicideEvent(data: SuicideEventNotificationData): this {
    return this.withEventType(EventType.PLAYER_SUICIDE)
      .withPlayer(data.playerId, data.playerName)
      .withPoints(data.skillPenalty)
      .withWeapon(data.weapon || "")
  }

  /**
   * Build message from team kill event data
   */
  fromTeamKillEvent(data: TeamKillEventNotificationData): this {
    return this.withEventType(EventType.PLAYER_TEAMKILL)
      .withKiller(data.killerId, data.killerName)
      .withVictim(data.victimId, data.victimName)
      .withPoints(data.skillPenalty)
      .withWeapon(data.weapon || "")
  }

  /**
   * Build message from action event data
   */
  fromActionEvent(data: ActionEventNotificationData): this {
    return this.withEventType(EventType.ACTION_PLAYER)
      .withPlayer(data.playerId, data.playerName)
      .withAction(data.actionCode, data.actionDescription)
      .withPoints(data.points)
  }

  /**
   * Build message from team action event data
   */
  fromTeamActionEvent(data: TeamActionEventNotificationData): this {
    return this.withEventType(EventType.ACTION_TEAM)
      .withTeam(data.team)
      .withAction(data.actionCode, data.actionDescription)
      .withPoints(data.points)
      .withPlayerCount(data.playerCount || 0)
  }

  /**
   * Build message from connect event data
   */
  fromConnectEvent(data: ConnectEventNotificationData): this {
    return this.withEventType(EventType.PLAYER_CONNECT).withPlayer(data.playerId, data.playerName)
  }

  /**
   * Build message from disconnect event data
   */
  fromDisconnectEvent(data: DisconnectEventNotificationData): this {
    return this.withEventType(EventType.PLAYER_DISCONNECT)
      .withPlayer(data.playerId, data.playerName)
      .withConnectionTime(data.sessionDuration)
  }

  /**
   * Build the final formatted message
   */
  build(): string {
    const template = this.getTemplateForEventType()
    const context = this.buildTemplateContext()
    const rawMessage = this.replaceTemplateVariables(template, context)

    // Apply color formatting if formatter is available
    if (this.colorFormatter && this.colorFormatter.supportsColors()) {
      return this.applyColorFormatting(rawMessage, context)
    }

    return rawMessage
  }

  /**
   * Get the appropriate template for the current event type
   */
  private getTemplateForEventType(): string {
    switch (this.components.eventType) {
      case EventType.PLAYER_KILL:
        return this.templates.kill
      case EventType.PLAYER_SUICIDE:
        return this.templates.suicide
      case EventType.PLAYER_TEAMKILL:
        return this.templates.teamkill
      case EventType.ACTION_PLAYER:
        return this.templates.playerAction
      case EventType.ACTION_TEAM:
        return this.templates.teamAction
      case EventType.ACTION_PLAYER_PLAYER:
        return this.templates.playerPlayerAction
      case EventType.PLAYER_CONNECT:
        return this.templates.connect
      case EventType.PLAYER_DISCONNECT:
        return this.templates.disconnect
      default:
        return "[HLStatsNext]: Unknown event"
    }
  }

  /**
   * Build template context from components
   */
  private buildTemplateContext(): TemplateContext {
    const context: TemplateContext = {}

    // Killer information
    if (this.components.killer) {
      context.killerName = this.components.killer.name
      context.killerRank = this.components.killer.rank
    }

    // Victim information
    if (this.components.victim) {
      context.victimName = this.components.victim.name
      context.victimRank = this.components.victim.rank
    }

    // Player information
    if (this.components.player) {
      context.playerName = this.components.player.name
      context.playerRank = this.components.player.rank
    }

    // Other information
    context.team = this.components.team
    context.action = this.components.action?.description
    context.weapon = this.components.weapon
    context.headshot = this.components.headshot
    context.playerCount = this.components.playerCount
    context.connectionTime = this.components.connectionTime

    // Format points with appropriate sign
    if (this.components.points !== undefined) {
      context.points =
        this.components.points > 0 ? `+${this.components.points}` : `${this.components.points}`
    }

    return context
  }

  /**
   * Replace template variables with actual values
   */
  private replaceTemplateVariables(template: string, context: TemplateContext): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = context[key as keyof TemplateContext]
      if (value === undefined || value === null || value === "") {
        return match // Keep the placeholder if no value or empty string
      }
      return String(value)
    })
  }

  /**
   * Apply color formatting to the message
   */
  private applyColorFormatting(message: string, context: TemplateContext): string {
    if (!this.colorFormatter) {
      return message
    }

    let formattedMessage = message

    // Format the tag
    formattedMessage = formattedMessage.replace(
      /\[HLStatsNext\]/g,
      this.colorFormatter.formatTag("[HLStatsNext]"),
    )

    // Format player names
    if (context.killerName) {
      formattedMessage = formattedMessage.replace(
        new RegExp(context.killerName, "g"),
        this.colorFormatter.formatPlayerName(context.killerName),
      )
    }

    if (context.victimName) {
      formattedMessage = formattedMessage.replace(
        new RegExp(context.victimName, "g"),
        this.colorFormatter.formatPlayerName(context.victimName),
      )
    }

    if (context.playerName) {
      formattedMessage = formattedMessage.replace(
        new RegExp(context.playerName, "g"),
        this.colorFormatter.formatPlayerName(context.playerName),
      )
    }

    // Format points
    if (context.points) {
      const numPoints = parseInt(context.points.replace(/[+-]/, ""))
      const isPositive = context.points.startsWith("+")
      formattedMessage = formattedMessage.replace(
        new RegExp(context.points.replace(/[+-]/, "\\$&"), "g"),
        this.colorFormatter.formatPoints(isPositive ? numPoints : -numPoints),
      )
    }

    // Format ranks
    if (context.killerRank !== undefined) {
      formattedMessage = formattedMessage.replace(
        new RegExp(`#${context.killerRank}`, "g"),
        this.colorFormatter.formatRank(context.killerRank),
      )
    }

    if (context.victimRank !== undefined) {
      formattedMessage = formattedMessage.replace(
        new RegExp(`#${context.victimRank}`, "g"),
        this.colorFormatter.formatRank(context.victimRank),
      )
    }

    if (context.playerRank !== undefined) {
      formattedMessage = formattedMessage.replace(
        new RegExp(`#${context.playerRank}`, "g"),
        this.colorFormatter.formatRank(context.playerRank),
      )
    }

    // Format actions
    if (context.action) {
      formattedMessage = formattedMessage.replace(
        new RegExp(context.action, "g"),
        this.colorFormatter.formatAction(context.action),
      )
    }

    return formattedMessage
  }

  /**
   * Infer event type from data structure
   */
  private inferEventType(data: NotificationEventData): string {
    if ("killerId" in data && "victimId" in data && "skillAdjustment" in data) {
      return "kill"
    }
    if ("playerId" in data && "skillPenalty" in data && !("victimId" in data)) {
      return "suicide"
    }
    if ("killerId" in data && "victimId" in data && "skillPenalty" in data) {
      return "teamkill"
    }
    if ("playerId" in data && "actionCode" in data) {
      return "action"
    }
    if ("team" in data && "actionCode" in data) {
      return "teamAction"
    }
    if ("playerId" in data && "connectionTime" in data) {
      return "disconnect"
    }
    if ("playerId" in data) {
      return "connect"
    }
    return "unknown"
  }

  /**
   * Create a new builder instance
   */
  static create(): NotificationMessageBuilder {
    return new NotificationMessageBuilder()
  }
}
