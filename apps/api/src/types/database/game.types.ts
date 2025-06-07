import type { Game, Player, Prisma } from "@repo/database/client";

/**
 * Game entity with aggregated statistics
 */
export interface GameWithStats extends Game {
  readonly _count: {
    readonly players: number;
    readonly clans: number;
  };
}

/**
 * Game statistics summary
 */
export interface GameStatistics {
  readonly totalPlayers: number;
  readonly activePlayers: number;
  readonly totalKills: number;
  readonly totalDeaths: number;
  readonly averageSkill: number;
  readonly topPlayers: readonly Player[];
}

// Re-export Prisma-generated types for direct database operations
export type PrismaGameCreateInput = Prisma.GameCreateInput;
export type PrismaGameUncheckedCreateInput = Prisma.GameUncheckedCreateInput;
export type PrismaGameUpdateInput = Prisma.GameUpdateInput;
export type PrismaGameUncheckedUpdateInput = Prisma.GameUncheckedUpdateInput;
export type PrismaGameCreateManyInput = Prisma.GameCreateManyInput;
export type PrismaGameUpdateManyMutationInput =
  Prisma.GameUpdateManyMutationInput;

/**
 * Game include configuration for Prisma queries
 */
export const GAME_INCLUDE = {
  _count: {
    select: {
      players: true,
      clans: true,
    },
  },
} as const;

/**
 * Game with detailed stats include configuration
 */
export const GAME_WITH_STATS_INCLUDE = {
  ...GAME_INCLUDE,
  players: {
    take: 5,
    orderBy: {
      skill: "desc" as const,
    },
    include: {
      clan: true,
      country: true,
    },
  },
} as const;

/**
 * Game validation constraints
 */
export const GAME_CONSTRAINTS = {
  CODE: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 32,
  },
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 128,
  },
  REAL_GAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 32,
  },
} as const;

/**
 * Game query filters
 */
export interface GameFilters {
  readonly includeHidden?: boolean;
  readonly search?: string;
}

/**
 * Activity time constants
 */
export const ACTIVITY_TIMEFRAMES = {
  THIRTY_DAYS: 30 * 24 * 60 * 60, // 30 days in seconds
  SEVEN_DAYS: 7 * 24 * 60 * 60, // 7 days in seconds
  ONE_DAY: 24 * 60 * 60, // 1 day in seconds
} as const;

/**
 * Input for creating a game
 */
export interface CreateGameInput {
  code: string;
  name: string;
  realgame: string;
  hidden?: boolean;
}

/**
 * Input for updating a game
 */
export interface UpdateGameInput {
  name?: string;
  realgame?: string;
  hidden?: boolean;
}
