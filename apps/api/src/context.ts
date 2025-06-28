import { db } from "@repo/database/client"
import { PlayerService } from "./player/player.service"
import { GameService } from "./game/game.service"
import { ClanService } from "./clan/clan.service"
import { ServerService } from "./server/server.service"
import { AwardService } from "./award/award.service"
import { ActionService } from "./action/action.service"
import { WeaponService } from "./weapon/weapon.service"
import { RoleService } from "./role/role.service"
import { TeamService } from "./team/team.service"
import { RankService } from "./rank/rank.service"

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly db: typeof db
  readonly services: {
    readonly player: PlayerService
    readonly game: GameService
    readonly clan: ClanService
    readonly server: ServerService
    readonly award: AwardService
    readonly action: ActionService
    readonly weapon: WeaponService
    readonly role: RoleService
    readonly team: TeamService
    readonly rank: RankService
  }
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
      weapon: new WeaponService(db),
      role: new RoleService(db),
      team: new TeamService(db),
      rank: new RankService(db),
    },
    // Authentication context will be added during Phase 3.1
    // This will include:
    // - User session validation
    // - JWT token verification
    // - Role-based permissions
    // - Audit logging setup
  }
}
