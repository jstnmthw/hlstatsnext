/*
  EventProcessorService
  ---------------------
  Consumes raw events from the ingress queue, validates them, and stores them
  using the database package. At this stage it only exposes an enqueue method.
*/

import type { GameEvent } from "../../types/common/events.types.js";
import { DatabaseClient } from "../../database/client.js";
import { PlayerHandler } from "./handlers/player.handler.js";
import { WeaponHandler } from "./handlers/weapon.handler.js";
import { MatchHandler } from "./handlers/match.handler.js";
import { RankingHandler } from "./handlers/ranking.handler.js";

export interface IEventProcessor {
  enqueue(event: unknown): Promise<void>;
}

export class EventProcessorService implements IEventProcessor {
  private db: DatabaseClient;
  private playerHandler: PlayerHandler;
  private weaponHandler: WeaponHandler;
  private matchHandler: MatchHandler;
  private rankingHandler: RankingHandler;

  constructor() {
    this.db = new DatabaseClient();
    this.playerHandler = new PlayerHandler(this.db);
    this.weaponHandler = new WeaponHandler(this.db);
    this.matchHandler = new MatchHandler(this.db);
    this.rankingHandler = new RankingHandler(this.db);
  }

  async enqueue(event: unknown): Promise<void> {
    // TODO: Validate event structure and persist
    void event; // placeholder to avoid unused param lint
  }

  async processEvent(event: GameEvent): Promise<void> {
    try {
      // First, persist the event to the database
      await this.db.createGameEvent(event);

      // Route event to appropriate handlers
      await Promise.all([
        this.playerHandler.handleEvent(event),
        this.weaponHandler.handleEvent(event),
        this.matchHandler.handleEvent(event),
        this.rankingHandler.handleEvent(event),
      ]);
    } catch (error) {
      console.error("Failed to process event:", error);
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
