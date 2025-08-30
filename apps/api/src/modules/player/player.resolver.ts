import { builder } from "../../builder"
import { PlayerService } from "./player.service"
import type { GetServerPlayersFilters, GetPlayersFilters, PlayerServerStats } from "./player.types"

const playerService = new PlayerService()

// GraphQL Input Types
const GetPlayersFiltersInput = builder.inputType("GetPlayersFiltersInput", {
  fields: (t) => ({
    serverId: t.int({ required: false }),
    game: t.string({ required: false }),
    search: t.string({ required: false }),
    onlineOnly: t.boolean({ required: false }),
    recentOnly: t.boolean({ required: false }),
    recentDays: t.int({ required: false }),
  }),
})

const GetServerPlayersFiltersInput = builder.inputType("GetServerPlayersFiltersInput", {
  fields: (t) => ({
    search: t.string({ required: false }),
    onlineOnly: t.boolean({ required: false }),
    recentOnly: t.boolean({ required: false }),
    recentDays: t.int({ required: false }),
    minKills: t.int({ required: false }),
    minSkill: t.int({ required: false }),
  }),
})

// Player Server Stats Object Type
const PlayerServerStatsType = builder.objectRef<{
  playerId: number
  lastName: string
  skill: number
  kills: number
  deaths: number
  suicides: number
  headshots: number
  connectionTime: number
  lastEvent: Date | null
  lastSkillChange: Date | null
  activity: number
  country: string
  flag: string | null
  kdRatio: number
  headshotRatio: number
  isOnline: boolean
  sessionDuration?: number
  totalSessions: number
  favoriteServer: boolean
}>("PlayerServerStats")

PlayerServerStatsType.implement({
  fields: (t) => ({
    playerId: t.exposeInt("playerId"),
    lastName: t.exposeString("lastName"),
    skill: t.exposeInt("skill"),
    kills: t.exposeInt("kills"),
    deaths: t.exposeInt("deaths"),
    suicides: t.exposeInt("suicides"),
    headshots: t.exposeInt("headshots"),
    connectionTime: t.exposeInt("connectionTime"),
    lastEvent: t.expose("lastEvent", { type: "DateTime", nullable: true }),
    lastSkillChange: t.expose("lastSkillChange", { type: "DateTime", nullable: true }),
    activity: t.exposeInt("activity"),
    country: t.exposeString("country"),
    flag: t.exposeString("flag", { nullable: true }),
    kdRatio: t.exposeFloat("kdRatio"),
    headshotRatio: t.exposeFloat("headshotRatio"),
    isOnline: t.exposeBoolean("isOnline"),
    sessionDuration: t.exposeInt("sessionDuration", { nullable: true }),
    totalSessions: t.exposeInt("totalSessions"),
    favoriteServer: t.exposeBoolean("favoriteServer"),

    // Computed fields
    rank: t.field({
      type: "String",
      resolve: (player) => {
        // Simple rank calculation based on skill
        if (player.skill >= 2000) return "Elite"
        if (player.skill >= 1500) return "Expert"
        if (player.skill >= 1200) return "Advanced"
        if (player.skill >= 1000) return "Intermediate"
        if (player.skill >= 800) return "Novice"
        return "Beginner"
      },
    }),

    accuracyPercentage: t.field({
      type: "Float",
      resolve: (player) => {
        // This would need shots/hits data from EventLatency or similar
        // For now, return a placeholder calculation
        return player.headshots > 0 ? Number((player.headshotRatio / 2).toFixed(1)) : 0
      },
    }),
  }),
})

// Result Types
const GetPlayersResultType = builder.objectRef<{
  players: PlayerServerStats[]
  totalCount: number
}>("GetPlayersResult")

GetPlayersResultType.implement({
  fields: (t) => ({
    players: t.field({
      type: [PlayerServerStatsType],
      resolve: (result) => result.players,
    }),
    totalCount: t.exposeInt("totalCount"),
  }),
})

const GetServerPlayersResultType = builder.objectRef<{
  players: PlayerServerStats[]
  totalCount: number
  onlineCount: number
  recentCount: number
}>("GetServerPlayersResult")

GetServerPlayersResultType.implement({
  fields: (t) => ({
    players: t.field({
      type: [PlayerServerStatsType],
      resolve: (result) => result.players,
    }),
    totalCount: t.exposeInt("totalCount"),
    onlineCount: t.exposeInt("onlineCount"),
    recentCount: t.exposeInt("recentCount"),
  }),
})

// Query Resolvers
builder.queryField("getPlayers", (t) =>
  t.field({
    type: GetPlayersResultType,
    args: {
      filters: t.arg({ type: GetPlayersFiltersInput, required: false }),
      take: t.arg.int({ required: false }),
      skip: t.arg.int({ required: false }),
    },
    resolve: async (_, { filters, take, skip }) => {
      const playerFilters: GetPlayersFilters = {
        serverId: filters?.serverId || undefined,
        game: filters?.game || undefined,
        search: filters?.search || undefined,
        onlineOnly: filters?.onlineOnly || false,
        recentOnly: filters?.recentOnly || false,
        recentDays: filters?.recentDays || 30,
      }

      const sortOrder = playerService.buildPlayerOrderBy()

      return await playerService.getPlayers(
        playerFilters,
        { take: take || 50, skip: skip || 0 },
        sortOrder,
      )
    },
  }),
)

builder.queryField("getServerPlayers", (t) =>
  t.field({
    type: GetServerPlayersResultType,
    args: {
      serverId: t.arg.int({ required: true }),
      filters: t.arg({ type: GetServerPlayersFiltersInput, required: false }),
      take: t.arg.int({ required: false }),
      skip: t.arg.int({ required: false }),
      sortField: t.arg.string({ required: false }),
      sortOrder: t.arg.string({ required: false }),
    },
    resolve: async (_, { serverId, filters, take, skip, sortField, sortOrder }) => {
      const playerFilters: GetServerPlayersFilters = {
        search: filters?.search || undefined,
        onlineOnly: filters?.onlineOnly || false,
        recentOnly: filters?.recentOnly || false,
        recentDays: filters?.recentDays || 30,
        minKills: filters?.minKills || undefined,
        minSkill: filters?.minSkill || undefined,
      }

      const orderBy = playerService.buildPlayerOrderBy(
        sortField || "skill",
        (sortOrder as "asc" | "desc") || "desc",
      )

      return await playerService.getServerPlayers(
        serverId,
        playerFilters,
        { take: take || 50, skip: skip || 0 },
        orderBy,
      )
    },
  }),
)

builder.queryField("getPlayerById", (t) =>
  t.prismaField({
    type: "Player",
    args: {
      playerId: t.arg.int({ required: true }),
    },
    resolve: async (_, __, { playerId }) => {
      return await playerService.getPlayerById(playerId)
    },
  }),
)

// Note: These resolvers would need proper EventConnect and Player types to be defined in the schema
// For now, we'll simplify and just use the core player queries above
