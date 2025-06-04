import { builder } from "../builder";
import type { Player, Prisma } from "@repo/database/client";

// Define Player object using Prisma plugin
const Player = builder.prismaObject("Player", {
  fields: (t) => ({
    // Expose core database fields
    playerId: t.exposeInt("playerId"),
    lastName: t.exposeString("lastName"),
    fullName: t.exposeString("fullName", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    homepage: t.exposeString("homepage", { nullable: true }),

    // Add GraphQL id field mapped to playerId
    id: t.string({
      resolve: (player) => player.playerId.toString(),
    }),

    // Statistics
    kills: t.exposeInt("kills"),
    deaths: t.exposeInt("deaths"),
    suicides: t.exposeInt("suicides"),
    skill: t.exposeInt("skill"),
    shots: t.exposeInt("shots"),
    hits: t.exposeInt("hits"),
    teamkills: t.exposeInt("teamkills"),
    headshots: t.exposeInt("headshots"),

    // Computed fields
    killDeathRatio: t.float({
      resolve: (player) =>
        player.deaths > 0 ? player.kills / player.deaths : player.kills,
    }),

    accuracy: t.float({
      resolve: (player) =>
        player.shots > 0 ? (player.hits / player.shots) * 100 : 0,
    }),

    headshotRatio: t.float({
      resolve: (player) =>
        player.kills > 0 ? (player.headshots / player.kills) * 100 : 0,
    }),

    // Location data
    city: t.exposeString("city"),
    state: t.exposeString("state"),
    country: t.exposeString("country"),
    flag: t.exposeString("flag"),
    lat: t.exposeFloat("lat", { nullable: true }),
    lng: t.exposeFloat("lng", { nullable: true }),

    // Activity
    last_event: t.exposeInt("last_event"),
    connection_time: t.exposeInt("connection_time"),
    hideranking: t.exposeInt("hideranking"),

    // Game relation
    game: t.exposeString("game"),
    // gameData: t.relation("gameData"), // Enable when Game type is defined

    // Clan relation
    clan: t.exposeInt("clan"),
    // clanData: t.relation("clanData"), // Enable when Clan type is defined

    // Country relation
    // countryData: t.relation("countryData"), // Enable when needed

    // UniqueIds relation
    // uniqueIds: t.relation("uniqueIds"), // Enable when needed
  }),
});

// Define PlayerStatistics type for complex queries with rank calculation
const PlayerStatistics = builder.objectRef<{
  player: Player;
  killDeathRatio: number;
  accuracy: number;
  headshotRatio: number;
  rank: number | null;
}>("PlayerStatistics");

PlayerStatistics.implement({
  fields: (t) => ({
    player: t.field({
      type: Player,
      resolve: (stats) => stats.player,
    }),
    killDeathRatio: t.exposeFloat("killDeathRatio"),
    accuracy: t.exposeFloat("accuracy"),
    headshotRatio: t.exposeFloat("headshotRatio"),
    rank: t.exposeInt("rank", { nullable: true }),
  }),
});

// Input types for filtering and sorting
const PlayerSortField = builder.enumType("PlayerSortField", {
  values: {
    SKILL: { value: "skill" },
    KILLS: { value: "kills" },
    DEATHS: { value: "deaths" },
    LAST_EVENT: { value: "last_event" },
    CONNECTION_TIME: { value: "connection_time" },
  },
});

const SortDirection = builder.enumType("SortDirection", {
  values: {
    ASC: { value: "asc" },
    DESC: { value: "desc" },
  },
});

// Enhanced filter input for players
const PlayerFiltersInput = builder.inputType("PlayerFiltersInput", {
  fields: (t) => ({
    gameId: t.string({ required: false }),
    clanId: t.string({ required: false }),
    countryId: t.string({ required: false }),
    hideRanking: t.boolean({ required: false }),
    minSkill: t.int({ required: false }),
    maxSkill: t.int({ required: false }),
    minKills: t.int({ required: false }),
    search: t.string({ required: false }),
  }),
});

// Input for creating a player
const CreatePlayerInput = builder.inputType("CreatePlayerInput", {
  fields: (t) => ({
    steamId: t.string({ required: true }),
    gameId: t.string({ required: true }),
    lastName: t.string({ required: true }),
    fullName: t.string({ required: false }),
    email: t.string({ required: false }),
    homepage: t.string({ required: false }),
    clanId: t.string({ required: false }),
    countryId: t.string({ required: false }),
    city: t.string({ required: false }),
    state: t.string({ required: false }),
    lastAddress: t.string({ required: false }),
  }),
});

// Input for updating player stats (daemon use)
const UpdatePlayerStatsInput = builder.inputType("UpdatePlayerStatsInput", {
  fields: (t) => ({
    steamId: t.string({ required: true }),
    gameId: t.string({ required: true }),
    kills: t.int({ required: false }),
    deaths: t.int({ required: false }),
    suicides: t.int({ required: false }),
    shots: t.int({ required: false }),
    hits: t.int({ required: false }),
    headshots: t.int({ required: false }),
    teamkills: t.int({ required: false }),
    skill: t.int({ required: false }),
    connectionTime: t.int({ required: false }),
    lastEvent: t.int({ required: false }),
  }),
});

// Query to get all players with enhanced filtering and pagination
builder.queryField("players", (t) =>
  t.prismaField({
    type: [Player],
    args: {
      filters: t.arg({ type: PlayerFiltersInput, required: false }),
      limit: t.arg.int({ defaultValue: 50 }),
      offset: t.arg.int({ defaultValue: 0 }),
      sortField: t.arg({ type: PlayerSortField, defaultValue: "skill" }),
      sortDirection: t.arg({ type: SortDirection, defaultValue: "desc" }),
    },
    resolve: async (query, _parent, args, context) => {
      const whereClause: Prisma.PlayerWhereInput = {};

      if (args.filters) {
        if (args.filters.gameId) {
          whereClause.game = args.filters.gameId;
        }
        if (args.filters.clanId) {
          whereClause.clan = Number(args.filters.clanId);
        }
        if (args.filters.countryId) {
          whereClause.flag = args.filters.countryId;
        }
        if (typeof args.filters.hideRanking === "boolean") {
          whereClause.hideranking = args.filters.hideRanking ? 1 : 0;
        }
        if (
          args.filters.minSkill !== undefined &&
          args.filters.minSkill !== null
        ) {
          whereClause.skill = {
            ...((whereClause.skill as object) || {}),
            gte: args.filters.minSkill,
          };
        }
        if (
          args.filters.maxSkill !== undefined &&
          args.filters.maxSkill !== null
        ) {
          whereClause.skill = {
            ...((whereClause.skill as object) || {}),
            lte: args.filters.maxSkill,
          };
        }
        if (
          args.filters.minKills !== undefined &&
          args.filters.minKills !== null
        ) {
          whereClause.kills = { gte: args.filters.minKills };
        }
        if (args.filters.search) {
          whereClause.OR = [
            { lastName: { contains: args.filters.search } },
            { fullName: { contains: args.filters.search } },
          ];
        }
      }

      const orderBy: Record<string, string> = {};
      if (args.sortField && args.sortDirection) {
        orderBy[args.sortField] = args.sortDirection;
      }

      return context.db.player.findMany({
        ...query,
        where: whereClause,
        orderBy,
        take: Math.min(args.limit ?? 50, 100), // Cap at 100
        skip: args.offset ?? 0,
      });
    },
  })
);

// Query to get a single player by ID
builder.queryField("player", (t) =>
  t.prismaField({
    type: Player,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, context) => {
      const playerId = parseInt(args.id);
      if (isNaN(playerId)) {
        return null;
      }

      return context.db.player.findUnique({
        ...query,
        where: { playerId },
      });
    },
  })
);

// Query to get a player by Steam ID
builder.queryField("playerBySteamId", (t) =>
  t.prismaField({
    type: Player,
    nullable: true,
    args: {
      steamId: t.arg.string({ required: true }),
      gameId: t.arg.string({ required: false }),
    },
    resolve: async (query, _parent, args, context) => {
      const whereClause: Prisma.PlayerWhereInput = {
        uniqueIds: {
          some: {
            uniqueId: args.steamId,
            ...(args.gameId && { game: args.gameId }),
          },
        },
      };

      return context.db.player.findFirst({
        ...query,
        where: whereClause,
      });
    },
  })
);

// Query to get top players for a game
builder.queryField("topPlayers", (t) =>
  t.prismaField({
    type: [Player],
    args: {
      gameId: t.arg.string({ required: true }),
      limit: t.arg.int({ defaultValue: 10 }),
    },
    resolve: async (query, _parent, args, context) => {
      return context.db.player.findMany({
        ...query,
        where: {
          game: args.gameId,
          hideranking: 0,
        },
        orderBy: {
          skill: "desc",
        },
        take: Math.min(args.limit ?? 10, 100),
      });
    },
  })
);

// Query to get player statistics with rank calculation
builder.queryField("playerStats", (t) =>
  t.field({
    type: PlayerStatistics,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.player.getPlayerStats(args.id);

      if (!result.success) {
        if (result.error.type === "NOT_FOUND") {
          return null;
        }
        throw new Error(result.error.message);
      }

      // Ensure the returned data matches our GraphQL type structure
      return {
        player: result.data.player,
        killDeathRatio: result.data.killDeathRatio,
        accuracy: result.data.accuracy,
        headshotRatio: result.data.headshotRatio,
        rank: result.data.rank,
      };
    },
  })
);

// Mutation to create a new player
builder.mutationField("createPlayer", (t) =>
  t.field({
    type: Player,
    args: {
      input: t.arg({ type: CreatePlayerInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      // Convert null values to undefined for the service
      const cleanedInput = {
        ...args.input,
        fullName: args.input.fullName ?? undefined,
        email: args.input.email ?? undefined,
        homepage: args.input.homepage ?? undefined,
        clanId: args.input.clanId ?? undefined,
        countryId: args.input.countryId ?? undefined,
        city: args.input.city ?? undefined,
        state: args.input.state ?? undefined,
        lastAddress: args.input.lastAddress ?? undefined,
      };

      const result = await context.services.player.createPlayer(cleanedInput);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  })
);

// Mutation to update player statistics (for daemon use)
builder.mutationField("updatePlayerStats", (t) =>
  t.field({
    type: Player,
    args: {
      input: t.arg({ type: UpdatePlayerStatsInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.player.updatePlayerStats(
        args.input.steamId,
        args.input.gameId,
        {
          steamId: args.input.steamId,
          gameId: args.input.gameId,
          kills: args.input.kills ?? undefined,
          deaths: args.input.deaths ?? undefined,
          suicides: args.input.suicides ?? undefined,
          shots: args.input.shots ?? undefined,
          hits: args.input.hits ?? undefined,
          headshots: args.input.headshots ?? undefined,
          teamkills: args.input.teamkills ?? undefined,
          skill: args.input.skill ?? undefined,
          connectionTime: args.input.connectionTime ?? undefined,
          lastEvent: args.input.lastEvent ?? undefined,
        }
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  })
);
