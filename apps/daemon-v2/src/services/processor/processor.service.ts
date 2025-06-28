/*
  EventProcessorService
  ---------------------
  Consumes raw events from the ingress queue, validates them, and stores them
  using the database package. At this stage it only exposes an enqueue method.
*/

import { EventType } from "@/types/common/events";
import type { GameEvent, PlayerMeta } from "@/types/common/events";
import { DatabaseClient } from "@/database/client";
import { PlayerHandler } from "./handlers/player.handler";
import { WeaponHandler } from "./handlers/weapon.handler";
import { MatchHandler } from "./handlers/match.handler";
import { RankingHandler } from "./handlers/ranking.handler";
import { logger } from "@/utils/logger";
import { EventEmitter } from "events";

export interface IEventProcessor {
  enqueue(event: unknown): Promise<void>;
}

export class EventProcessorService
  extends EventEmitter
  implements IEventProcessor
{
  private readonly db: DatabaseClient;
  private readonly opts: { logBots?: boolean };

  // Retain existing handlers for future expansion, but they are optional in this minimal path
  private readonly playerHandler?: PlayerHandler;
  private readonly weaponHandler?: WeaponHandler;
  private readonly matchHandler?: MatchHandler;
  private readonly rankingHandler?: RankingHandler;

  constructor(db?: DatabaseClient, opts: { logBots?: boolean } = {}) {
    super();

    // If a DatabaseClient is supplied use it, otherwise create a new one so that
    // existing callers (e.g. production entry-point) remain functional.
    this.db = db ?? new DatabaseClient();
    this.opts = opts;

    // Preserve existing handlers for compatibility - they'll be wired up only
    // when the caller hasn't opted-in to "happy-path" processing (future work).
    if (!opts || Object.keys(opts).length === 0) {
      this.playerHandler = new PlayerHandler(this.db);
      this.weaponHandler = new WeaponHandler(this.db);
      this.matchHandler = new MatchHandler(this.db);
      this.rankingHandler = new RankingHandler(this.db);
    }
  }

  /* Existing enqueue placeholder (kept for API compatibility).
   * IDEALLY this will be removed in a later refactor when queueing lands. */
  async enqueue(event: unknown): Promise<void> {
    void event;
  }

  async processEvent(event: GameEvent & { meta?: PlayerMeta }): Promise<void> {
    // 0. Bot gate - allow in dev, ignore in prod unless logBots=true
    if (event.meta?.isBot && !this.opts.logBots) {
      return;
    }

    try {
      switch (event.eventType) {
        case EventType.PLAYER_CONNECT: {
          const meta = event.meta;

          if (!meta) {
            logger.warn("CONNECT event missing meta - skipped");
            break;
          }

          const { steamId, playerName } = meta;

          // Leverage existing helper that handles Player & PlayerUniqueId tables.
          await this.db.getOrCreatePlayer(steamId, playerName, "cstrike");

          break;
        }

        case EventType.PLAYER_KILL: {
          await this.db.createGameEvent(event);

          break;
        }

        case EventType.CHAT_MESSAGE: {
          const meta = event.meta;

          if (!meta) {
            logger.warn("CHAT event missing meta - skipped");
            break;
          }

          const { steamId, playerName } = meta;

          // Upsert player
          const playerId = await this.db.getOrCreatePlayer(
            steamId,
            playerName,
            "cstrike",
          );

          // Assign resolved playerId and persist chat event with proper type
          const chatEvent =
            event as import("@/types/common/events").PlayerChatEvent;
          chatEvent.data.playerId = playerId;

          await this.db.createGameEvent(chatEvent);

          break;
        }

        default:
          // Ignore unsupported events in MVP
          break;
      }

      this.emit("eventProcessed", { success: true, event });
    } catch (error) {
      logger.failed(
        "Failed to process event",
        error instanceof Error ? error.message : String(error),
      );
      this.emit("eventProcessed", {
        success: false,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection(): Promise<boolean> {
    return this.db.testConnection();
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.db.disconnect();
  }
}
