import type { Context } from "../../context";
import type {
  PlayerFilters,
  PlayerSortInput,
  CreatePlayerInput,
  UpdatePlayerStatsInput,
} from "../database/player.types";
import type { ClanFilters } from "../database/clan.types";
import type { PaginationInput } from "../common/pagination.types";

/**
 * GraphQL resolver parent types
 */
export interface GraphQLParent {
  readonly [key: string]: unknown;
}

/**
 * Base GraphQL resolver function type
 */
export type GraphQLResolver<
  TParent = GraphQLParent,
  TArgs = Record<string, unknown>,
  TResult = unknown,
> = (
  parent: TParent,
  args: TArgs,
  context: Context,
  info?: unknown
) => Promise<TResult> | TResult;

/**
 * Query resolver argument types
 */
export interface GameQueryArgs {
  readonly id: string;
}

export interface GameByCodeQueryArgs {
  readonly code: string;
}

export interface GameStatsQueryArgs {
  readonly gameId: string;
}

export interface GamesQueryArgs {
  readonly includeHidden?: boolean;
}

export interface PlayersQueryArgs {
  readonly filters?: PlayerFilters;
  readonly sort?: PlayerSortInput;
  readonly pagination?: PaginationInput;
}

export interface PlayerQueryArgs {
  readonly id: string;
}

export interface PlayerBySteamIdQueryArgs {
  readonly steamId: string;
  readonly gameId?: string;
}

export interface PlayerStatsQueryArgs {
  readonly playerId: string;
}

export interface TopPlayersQueryArgs {
  readonly gameId: string;
  readonly limit?: number;
}

export interface ClansQueryArgs {
  readonly filters?: ClanFilters;
}

export interface ClanQueryArgs {
  readonly id: string;
}

export interface ClanStatsQueryArgs {
  readonly clanId: string;
}

export interface TopClansQueryArgs {
  readonly gameId: string;
  readonly limit?: number;
}

export interface CountryQueryArgs {
  readonly id: string;
}

/**
 * Mutation resolver argument types
 */
export interface CreatePlayerMutationArgs {
  readonly input: CreatePlayerInput;
}

export interface UpdatePlayerStatsMutationArgs {
  readonly input: UpdatePlayerStatsInput;
}

/**
 * GraphQL field resolver types for computed fields
 */
export interface PlayerFieldResolvers {
  readonly killDeathRatio: GraphQLResolver<
    { kills: number; deaths: number },
    Record<string, never>,
    number
  >;
  readonly accuracy: GraphQLResolver<
    { hits: number; shots: number },
    Record<string, never>,
    number
  >;
  readonly headshotRatio: GraphQLResolver<
    { headshots: number; kills: number },
    Record<string, never>,
    number
  >;
}

/**
 * Health status response type
 */
export interface HealthStatusResponse {
  readonly status: string;
  readonly timestamp: string;
  readonly version: string;
}

/**
 * GraphQL enum mappings
 */
export const GraphQLPlayerSortFieldMap = {
  SKILL: "skill",
  KILLS: "kills",
  DEATHS: "deaths",
  HEADSHOTS: "headshots",
  CONNECTION_TIME: "connectionTime",
  CREATED_AT: "createdAt",
} as const;

export const GraphQLSortDirectionMap = {
  ASC: "asc",
  DESC: "desc",
} as const;

/**
 * Subscription resolver types (for future implementation)
 */
export interface PlayerUpdatedSubscriptionArgs {
  readonly gameId: string;
}

export interface GameStatsUpdatedSubscriptionArgs {
  readonly gameId: string;
}
