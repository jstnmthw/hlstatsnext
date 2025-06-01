// Service exports
export { PlayerService } from "./player.service";
export { GameService } from "./game.service";
export { ClanService } from "./clan.service";

// Re-export commonly used types from the database layer
export type {
  // Player types
  PlayerWithRelations,
  PlayerFilters,
  PlayerSortInput,
  PlayerStatistics,
  CreatePlayerInput,
  UpdatePlayerStatsInput,

  // Game types
  GameWithStats,
  GameStatistics,
  GameFilters,

  // Clan types
  ClanWithRelations,
  ClanWithAverageSkill,
  ClanStatistics,
  ClanFilters,
} from "../types/database";

// Re-export common utility types
export type {
  Result,
  Success,
  Failure,
  AppError,
  PaginatedResponse,
  PaginationInput,
} from "../types/common";
