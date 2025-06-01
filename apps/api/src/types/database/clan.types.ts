import type { Clan, Game, Player, Prisma } from "@repo/database/client";

/**
 * Clan entity with all related data loaded
 */
export interface ClanWithRelations extends Clan {
  readonly game: Game;
  readonly players: readonly Player[];
  readonly _count: {
    readonly players: number;
  };
}

/**
 * Clan with average skill calculation
 */
export interface ClanWithAverageSkill extends ClanWithRelations {
  readonly averageSkill: number;
}

/**
 * Clan statistics with calculated values
 */
export interface ClanStatistics {
  readonly clan: ClanWithRelations;
  readonly totalKills: number;
  readonly totalDeaths: number;
  readonly averageSkill: number;
  readonly topPlayer: Player | null;
  readonly killDeathRatio: number;
}

/**
 * Clan filter parameters
 */
export interface ClanFilters {
  readonly gameId?: string;
  readonly hidden?: boolean;
  readonly search?: string;
  readonly hasPlayers?: boolean;
}

/**
 * Business logic input for clan creation
 * This maintains the existing API for business logic
 */
export interface CreateClanInput {
  readonly tag: string;
  readonly name: string;
  readonly gameId: string;
  readonly homepage?: string;
  readonly mapRegion?: string;
  readonly hidden?: boolean;
}

/**
 * Business logic input for clan updates
 * This maintains the existing API for business logic
 */
export interface UpdateClanInput {
  readonly tag?: string;
  readonly name?: string;
  readonly homepage?: string;
  readonly mapRegion?: string;
  readonly hidden?: boolean;
}

// Re-export Prisma-generated types for direct database operations
export type PrismaClanCreateInput = Prisma.ClanCreateInput;
export type PrismaClanUncheckedCreateInput = Prisma.ClanUncheckedCreateInput;
export type PrismaClanUpdateInput = Prisma.ClanUpdateInput;
export type PrismaClanUncheckedUpdateInput = Prisma.ClanUncheckedUpdateInput;
export type PrismaClanCreateManyInput = Prisma.ClanCreateManyInput;
export type PrismaClanUpdateManyMutationInput =
  Prisma.ClanUpdateManyMutationInput;

/**
 * Clan include configuration for Prisma queries
 */
export const CLAN_INCLUDE = {
  game: true,
  players: {
    take: 10,
    orderBy: {
      skill: "desc" as const,
    },
  },
  _count: {
    select: {
      players: true,
    },
  },
} as const;

/**
 * Clan with all players include configuration
 */
export const CLAN_WITH_ALL_PLAYERS_INCLUDE = {
  game: true,
  players: {
    orderBy: {
      skill: "desc" as const,
    },
  },
  _count: {
    select: {
      players: true,
    },
  },
} as const;

/**
 * Clan validation constraints
 */
export const CLAN_CONSTRAINTS = {
  TAG: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 64,
  },
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 128,
  },
  HOMEPAGE: {
    MAX_LENGTH: 64,
  },
  MAP_REGION: {
    MAX_LENGTH: 128,
  },
} as const;
