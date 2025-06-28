import { BaseParser, ParseResult } from "./base.parser";
import {
  EventType,
  type PlayerConnectEvent,
  type PlayerDisconnectEvent,
  type PlayerKillEvent,
} from "@/types/common/events";

/**
 * Minimal Counter-Strike (Source / GO) log parser.
 *
 * ✅ PLAYER_CONNECT
 * ✅ PLAYER_DISCONNECT
 * ✅ PLAYER_KILL
 *
 * This is intentionally lightweight - regexes are crude but good enough for a
 * phase-1 prototype. They can be hardened later.
 */
export class CsParser extends BaseParser {
  constructor(game: string) {
    super(game);
  }

  canParse(rawLogLine: string): boolean {
    const logLine = this.normaliseLogLine(rawLogLine);

    if (logLine.startsWith("L ")) {
      return true;
    }

    // Provide trimmed context for easier debugging
    console.warn(`Unsupported log line: ${logLine}`);
    return false;
  }

  async parse(rawLogLine: string, serverId: number): Promise<ParseResult> {
    const logLine = this.normaliseLogLine(rawLogLine);

    // Order matters - check for kill first as it also contains a quoted player string.
    const kill = await this.parseKill(logLine, serverId);
    if (kill) return { success: true, event: kill };

    const connect = await this.parseConnect(logLine, serverId);
    if (connect) return { success: true, event: connect };

    const disconnect = await this.parseDisconnect(logLine, serverId);
    if (disconnect) return { success: true, event: disconnect };

    const chat = await this.parseChat(logLine, serverId);
    if (chat) return { success: true, event: chat };

    return { success: false, error: "Unsupported log line" };
  }

  private async parseConnect(
    logLine: string,
    serverId: number,
  ): Promise<PlayerConnectEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:33:10: "PlayerName<1><STEAM_1:0:12345><CT>" connected, address "1.2.3.4:27005"
    */
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" connected, address "([\d.]+):/i;
    const match = logLine.match(regex);
    if (!match) return null;

    const playerName = match[1]!;
    const steamId = match[2]!;
    const ipAddress = match[3]!;
    const isBot = steamId.toUpperCase() === "BOT";

    const event: PlayerConnectEvent & {
      meta?: { steamId: string; playerName: string; isBot: boolean };
    } = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp: this.extractTimestamp(logLine) ?? new Date(),
      serverId,
      data: {
        playerId: 0, // Will be resolved later by PlayerHandler
        steamId,
        playerName: this.sanitizeString(playerName),
        ipAddress,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot,
      },
    };

    return event;
  }

  private async parseDisconnect(
    logLine: string,
    serverId: number,
  ): Promise<PlayerDisconnectEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected (reason "Client left game")
    */
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" disconnected(?: \(reason\s+"(.+?)"\))?/i;
    const match = logLine.match(regex);
    if (!match) return null;

    const reason = match[3];

    const event: PlayerDisconnectEvent = {
      eventType: EventType.PLAYER_DISCONNECT,
      timestamp: this.extractTimestamp(logLine) ?? new Date(),
      serverId,
      data: {
        playerId: 0, // Unknown until we correlate - optional in handler
        reason,
      },
    };

    return event;
  }

  private async parseKill(
    logLine: string,
    serverId: number,
  ): Promise<PlayerKillEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "ak47" (headshot)
    */
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?killed "(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?with "(\w+)"( \(headshot\))?/i;
    const match = logLine.match(regex);
    if (!match) return null;

    // const killerSteam = match[2]!;
    const killerTeam = match[3]!;
    // const victimSteam = match[5]!;
    const victimTeam = match[6]!;
    const weapon = match[7]!;
    const headshotGroup = match[8];

    const event: PlayerKillEvent = {
      eventType: EventType.PLAYER_KILL,
      timestamp: this.extractTimestamp(logLine) ?? new Date(),
      serverId,
      data: {
        // player IDs will be resolved by PlayerHandler downstream
        killerId: 0,
        victimId: 0,
        weapon,
        headshot: Boolean(headshotGroup),
        killerTeam,
        victimTeam,
      },
    };

    return event;
  }

  /*
   * Parse player chat messages
   * Example:
   * L 06/28/2025 - 09:09:32: "goat<5><BOT><CT>" say "Too bad NNBot is discontinued..." (dead)
   */
  private async parseChat(
    logLine: string,
    serverId: number,
  ): Promise<import("@/types/common/events").PlayerChatEvent | null> {
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>"\s+say\s+"([^"]+)"(?:\s+\((dead)\))?/i;

    const match = logLine.match(regex);
    if (!match) return null;

    const playerName = match[1]!;
    const steamId = match[2]!;
    const team = match[3]!;
    const message = match[4]!;
    const isDead = Boolean(match[5]);

    const isBot = steamId.toUpperCase() === "BOT";

    const event: import("@/types/common/events").PlayerChatEvent & {
      meta: { steamId: string; playerName: string; isBot: boolean };
    } = {
      eventType: EventType.CHAT_MESSAGE,
      timestamp: this.extractTimestamp(logLine) ?? new Date(),
      serverId,
      data: {
        playerId: 0,
        message,
        team,
        isDead,
        messageMode: isDead ? 1 : 0,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot,
      },
    };

    return event;
  }
}
