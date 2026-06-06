/**
 * Custom Player prismaObject that admin-gates PII fields (email, lastAddress,
 * fullName, lat, lng). Replaces the auto-generated Player object to prevent
 * unauthenticated exposure of personally identifiable information. Admins
 * can still read those fields via field-level requireAdmin resolvers.
 */
import { builder } from "../../builder"
import { requireAdmin } from "../../context"

builder.prismaObject("Player", {
  findUnique: ({ playerId }) => ({ playerId }),
  fields: (t) => ({
    // Identity
    playerId: t.exposeInt("playerId"),
    clanId: t.exposeInt("clanId", { nullable: true }),
    lastName: t.exposeString("lastName"),

    // PII — admin-only. Resolvers throw FORBIDDEN for non-admins.
    lastAddress: t.string({
      nullable: true,
      resolve: (player, _args, ctx) => {
        requireAdmin(ctx)
        return player.lastAddress
      },
    }),
    fullName: t.string({
      nullable: true,
      resolve: (player, _args, ctx) => {
        requireAdmin(ctx)
        return player.fullName
      },
    }),
    email: t.string({
      nullable: true,
      resolve: (player, _args, ctx) => {
        requireAdmin(ctx)
        return player.email
      },
    }),
    lat: t.float({
      nullable: true,
      resolve: (player, _args, ctx) => {
        requireAdmin(ctx)
        return player.lat
      },
    }),
    lng: t.float({
      nullable: true,
      resolve: (player, _args, ctx) => {
        requireAdmin(ctx)
        return player.lng
      },
    }),

    // Event tracking
    lastEvent: t.expose("lastEvent", { type: "DateTime", nullable: true }),
    lastSkillChange: t.expose("lastSkillChange", { type: "DateTime", nullable: true }),
    connectionTime: t.exposeInt("connectionTime"),

    // Location data (non-precise — country/city/region only)
    city: t.exposeString("city"),
    state: t.exposeString("state"),
    country: t.exposeString("country"),
    flag: t.exposeString("flag", { nullable: true }),

    // Core statistics
    kills: t.exposeInt("kills"),
    deaths: t.exposeInt("deaths"),
    suicides: t.exposeInt("suicides"),
    skill: t.exposeInt("skill"),
    shots: t.exposeInt("shots"),
    hits: t.exposeInt("hits"),
    teamkills: t.exposeInt("teamkills"),
    headshots: t.exposeInt("headshots"),

    // Streaks and activity
    killStreak: t.exposeInt("killStreak"),
    deathStreak: t.exposeInt("deathStreak"),
    activity: t.exposeInt("activity"),

    // Game
    game: t.exposeString("game"),

    // Preferences
    hideRanking: t.exposeInt("hideRanking"),
    displayEvents: t.exposeInt("displayEvents"),
    blockAvatar: t.exposeInt("blockAvatar"),

    // Misc
    mmrank: t.exposeInt("mmrank", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime", nullable: true }),
    isBot: t.exposeBoolean("isBot"),

    // Relations
    countryData: t.relation("countryData", { nullable: true }),
    clan: t.relation("clan", { nullable: true }),
    gameData: t.relation("gameData"),
    uniqueIds: t.relation("uniqueIds"),
    awardsWonAsDWinner: t.relation("awardsWonAsDWinner"),
    awardsWonAsGWinner: t.relation("awardsWonAsGWinner"),
    nameChanges: t.relation("nameChanges"),
    roleChanges: t.relation("roleChanges"),
    teamChanges: t.relation("teamChanges"),
    chats: t.relation("chats"),
    connects: t.relation("connects"),
    disconnects: t.relation("disconnects"),
    entries: t.relation("entries"),
    fragsAsKiller: t.relation("fragsAsKiller"),
    fragsAsVictim: t.relation("fragsAsVictim"),
    latencyEvents: t.relation("latencyEvents"),
    playerActions: t.relation("playerActions"),
    playerPlayerActionsAsActor: t.relation("playerPlayerActionsAsActor"),
    playerPlayerActionsAsVictim: t.relation("playerPlayerActionsAsVictim"),
    suicideEvents: t.relation("suicideEvents"),
    teamBonuses: t.relation("teamBonuses"),
    teamkillsAsKiller: t.relation("teamkillsAsKiller"),
    teamkillsAsVictim: t.relation("teamkillsAsVictim"),
    awards: t.relation("awards"),
    history: t.relation("history"),
    ribbons: t.relation("ribbons"),
    names: t.relation("names"),
  }),
})
