import type {
  Player,
  Game,
  Clan,
  Country,
  PlayerUniqueId,
  Prisma,
} from "@repo/database/client";
import type { SortInput } from "../common/pagination.types";

/**
 * Player entity with all related data loaded
 */
export interface PlayerWithRelations extends Player {
  readonly game: Game;
  readonly clan: Clan | null;
  readonly country: Country | null;
  readonly uniqueIds: readonly PlayerUniqueId[];
}

/**
 * Player sortable fields
 */
export const PlayerSortField = {
  SKILL: "skill",
  KILLS: "kills",
  DEATHS: "deaths",
  HEADSHOTS: "headshots",
  CONNECTION_TIME: "connectionTime",
  CREATED_AT: "createdAt",
} as const;

export type PlayerSortFieldType =
  (typeof PlayerSortField)[keyof typeof PlayerSortField];

/**
 * Player sort input with specific fields
 */
export type PlayerSortInput = SortInput<PlayerSortFieldType>;

/**
 * Player filter parameters
 */
export interface PlayerFilters {
  readonly gameId?: string;
  readonly clanId?: string;
  readonly countryId?: string;
  readonly hideRanking?: boolean;
  readonly minSkill?: number;
  readonly maxSkill?: number;
  readonly minKills?: number;
  readonly search?: string;
}

/**
 * Player statistics with calculated values
 */
export interface PlayerStatistics {
  readonly player: PlayerWithRelations;
  readonly killDeathRatio: number;
  readonly accuracy: number;
  readonly headshotRatio: number;
  readonly rank: number | null;
}

/**
 * Business logic input for creating a player with Steam ID
 * This is a domain-specific input that extends Prisma's basic create input
 */
export interface CreatePlayerInput {
  readonly lastName: string;
  readonly steamId: string;
  readonly gameId: string;
  readonly fullName?: string;
  readonly email?: string;
  readonly homepage?: string;
  readonly clanId?: string;
  readonly countryId?: string;
  readonly city?: string;
  readonly state?: string;
  readonly lastAddress?: string;
}

/**
 * Business logic input for updating player statistics
 * This is a domain-specific input for stat updates
 */
export interface UpdatePlayerStatsInput {
  readonly steamId: string;
  readonly gameId: string;
  readonly kills?: number;
  readonly deaths?: number;
  readonly suicides?: number;
  readonly shots?: number;
  readonly hits?: number;
  readonly headshots?: number;
  readonly teamkills?: number;
  readonly skill?: number;
  readonly connectionTime?: number;
  readonly lastEvent?: number;
}

// Re-export Prisma-generated types for direct database operations
export type PrismaPlayerCreateInput = Prisma.PlayerCreateInput;
export type PrismaPlayerUncheckedCreateInput =
  Prisma.PlayerUncheckedCreateInput;
export type PrismaPlayerUpdateInput = Prisma.PlayerUpdateInput;
export type PrismaPlayerUncheckedUpdateInput =
  Prisma.PlayerUncheckedUpdateInput;
export type PrismaPlayerCreateManyInput = Prisma.PlayerCreateManyInput;
export type PrismaPlayerUpdateManyMutationInput =
  Prisma.PlayerUpdateManyMutationInput;

/**
 * Player query parameters for database operations
 */
export interface PlayerQueryParams {
  readonly filters: PlayerFilters;
  readonly sort: PlayerSortInput;
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly skip: number;
  };
}

/**
 * Player include configuration for Prisma queries
 */
export const PLAYER_INCLUDE = {
  game: true,
  clan: true,
  country: true,
  uniqueIds: true,
} as const;

/**
 * Player validation constraints
 */
export const PLAYER_CONSTRAINTS = {
  LAST_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 64,
  },
  FULL_NAME: {
    MAX_LENGTH: 128,
  },
  EMAIL: {
    MAX_LENGTH: 64,
  },
  HOMEPAGE: {
    MAX_LENGTH: 64,
  },
  CITY: {
    MAX_LENGTH: 64,
  },
  STATE: {
    MAX_LENGTH: 64,
  },
  SKILL: {
    MIN: 0,
    MAX: 10000,
    DEFAULT: 1000,
  },
} as const;
