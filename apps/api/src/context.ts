import { db } from "@repo/database/client";
import { PlayerService, GameService, ClanService } from "./services";

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly db: typeof db;
  readonly services: {
    readonly player: PlayerService;
    readonly game: GameService;
    readonly clan: ClanService;
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
    },
    // Authentication context will be added during Phase 3.1
    // This will include:
    // - User session validation
    // - JWT token verification
    // - Role-based permissions
    // - Audit logging setup
  };
}
