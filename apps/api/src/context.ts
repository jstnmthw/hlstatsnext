import { db } from "@repo/database/client";
import { PlayerService } from "./player/player.service";
import { GameService } from "./game/game.service";
import { ClanService } from "./clan/clan.service";
import { ServerService } from "./server/server.service";
import { AwardService } from "./award/award.service";
import { ActionService } from "./action/action.service";

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly db: typeof db;
  readonly services: {
    readonly player: PlayerService;
    readonly game: GameService;
    readonly clan: ClanService;
    readonly server: ServerService;
    readonly award: AwardService;
    readonly action: ActionService;
  };
  // Authentication context will be added during Phase 3.1
  // readonly user?: User;
  // readonly session?: Session;
}

/**
 * Create GraphQL context with dependency injection
 */
export function createContext(): Context {
  return {
    db,
    services: {
      player: new PlayerService(db),
      game: new GameService(db),
      clan: new ClanService(db),
      server: new ServerService(db),
      award: new AwardService(db),
      action: new ActionService(db),
    },
    // Authentication context will be added during Phase 3.1
    // This will include:
    // - User session validation
    // - JWT token verification
    // - Role-based permissions
    // - Audit logging setup
  };
}
