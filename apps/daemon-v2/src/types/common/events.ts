/**
 * Core Event Types for HLStats Daemon v2
 *
 * These types define the structure of game events that flow through
 * the processing pipeline from ingress to statistics calculation.
 */

export enum EventType {
  PLAYER_CONNECT = "PLAYER_CONNECT",
  PLAYER_DISCONNECT = "PLAYER_DISCONNECT",
  PLAYER_KILL = "PLAYER_KILL",
  PLAYER_DEATH = "PLAYER_DEATH",
  PLAYER_SUICIDE = "PLAYER_SUICIDE",
  PLAYER_TEAMKILL = "PLAYER_TEAMKILL",
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  MAP_CHANGE = "MAP_CHANGE",
  SERVER_SHUTDOWN = "SERVER_SHUTDOWN",
  ADMIN_ACTION = "ADMIN_ACTION",
  CHAT_MESSAGE = "CHAT_MESSAGE",
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface BaseEvent {
  eventType: EventType;
  timestamp: Date;
  serverId: number;
  raw?: string; // Original log line for debugging
  /**
   * Optional payload for events that do not have a specific data structure.
   * This is primarily to allow ergonomic access in generic code paths (e.g. tests)
   * without resorting to explicit casts. Event-specific interfaces should override
   * this with a strongly-typed version.
   */
  data?: unknown;
}

export interface PlayerKillEvent extends BaseEvent {
  eventType: EventType.PLAYER_KILL;
  data: {
    killerId: number;
    victimId: number;
    weapon: string;
    headshot: boolean;
    distance?: number;
    killerPosition?: Position3D;
    victimPosition?: Position3D;
    killerTeam: string;
    victimTeam: string;
  };
}

export interface PlayerConnectEvent extends BaseEvent {
  eventType: EventType.PLAYER_CONNECT;
  data: {
    playerId: number;
    steamId: string;
    playerName: string;
    ipAddress: string;
    country?: string;
    userAgent?: string;
  };
}

export interface PlayerDisconnectEvent extends BaseEvent {
  eventType: EventType.PLAYER_DISCONNECT;
  data: {
    playerId: number;
    reason?: string;
    sessionDuration?: number;
  };
}

export interface RoundEndEvent extends BaseEvent {
  eventType: EventType.ROUND_END;
  data: {
    winningTeam: string;
    duration: number;
    score: {
      team1: number;
      team2: number;
    };
  };
}

export interface MapChangeEvent extends BaseEvent {
  eventType: EventType.MAP_CHANGE;
  data: {
    previousMap?: string;
    newMap: string;
    playerCount: number;
  };
}

export type GameEvent =
  | PlayerKillEvent
  | PlayerConnectEvent
  | PlayerDisconnectEvent
  | RoundEndEvent
  | MapChangeEvent
  | BaseEvent; // Fallback for other event types

export interface ProcessedEvent {
  id: string;
  event: GameEvent;
  processedAt: Date;
  success: boolean;
  error?: string;
}

export interface PlayerMeta {
  steamId: string;
  playerName: string;
  isBot: boolean;
}
