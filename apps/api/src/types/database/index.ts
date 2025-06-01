import { Prisma } from "@repo/database/client";

// Player types
export type {
  PlayerWithRelations,
  PlayerSortFieldType,
  PlayerSortInput,
  PlayerFilters,
  PlayerStatistics,
  CreatePlayerInput,
  UpdatePlayerStatsInput,
  PlayerQueryParams,
} from "./player.types";

export {
  PlayerSortField,
  PLAYER_INCLUDE,
  PLAYER_CONSTRAINTS,
} from "./player.types";

// Game types
export type { GameWithStats, GameStatistics, GameFilters } from "./game.types";

export {
  GAME_INCLUDE,
  GAME_WITH_STATS_INCLUDE,
  GAME_CONSTRAINTS,
  ACTIVITY_TIMEFRAMES,
} from "./game.types";

// Clan types
export type {
  ClanWithRelations,
  ClanWithAverageSkill,
  ClanStatistics,
  ClanFilters,
  CreateClanInput,
  UpdateClanInput,
} from "./clan.types";

export {
  CLAN_INCLUDE,
  CLAN_WITH_ALL_PLAYERS_INCLUDE,
  CLAN_CONSTRAINTS,
} from "./clan.types";

// Domain-specific types
export * from "./player.types";
export * from "./game.types";
export * from "./clan.types";

// Re-export core Prisma types for convenience
export type {
  Player,
  Game,
  Clan,
  Country,
  PlayerUniqueId,
  Prisma,
} from "@repo/database/client";

// Common filter types from Prisma namespace
export type PlayerWhereInput = Prisma.PlayerWhereInput;
export type PlayerOrderByWithRelationInput =
  Prisma.PlayerOrderByWithRelationInput;
export type PlayerInclude = Prisma.PlayerInclude;
export type PlayerSelect = Prisma.PlayerSelect;

export type GameWhereInput = Prisma.GameWhereInput;
export type GameOrderByWithRelationInput = Prisma.GameOrderByWithRelationInput;
export type GameInclude = Prisma.GameInclude;
export type GameSelect = Prisma.GameSelect;

export type ClanWhereInput = Prisma.ClanWhereInput;
export type ClanOrderByWithRelationInput = Prisma.ClanOrderByWithRelationInput;
export type ClanInclude = Prisma.ClanInclude;
export type ClanSelect = Prisma.ClanSelect;

export type CountryWhereInput = Prisma.CountryWhereInput;
export type CountryOrderByWithRelationInput =
  Prisma.CountryOrderByWithRelationInput;
export type CountryInclude = Prisma.CountryInclude;
export type CountrySelect = Prisma.CountrySelect;

// Re-export commonly used Prisma utility types
export type StringFilter = Prisma.StringFilter;
export type IntFilter = Prisma.IntFilter;
export type StringNullableFilter = Prisma.StringNullableFilter;
export type IntNullableFilter = Prisma.IntNullableFilter;
export type FloatNullableFilter = Prisma.FloatNullableFilter;
export type SortOrder = Prisma.SortOrder;
