/**
 * Custom Server prismaObject that omits the rconPassword field.
 * Replaces the auto-generated Server object to prevent credential exposure (RT-002).
 */
import { builder } from "../../builder"

builder.prismaObject("Server", {
  findUnique: ({ serverId }) => ({ serverId }),
  fields: (t) => ({
    // Identity
    serverId: t.exposeInt("serverId"),
    address: t.exposeString("address"),
    port: t.exposeInt("port"),
    name: t.exposeString("name"),
    sortOrder: t.exposeInt("sortOrder"),
    game: t.exposeString("game"),
    publicAddress: t.exposeString("publicAddress"),
    statusUrl: t.string({ nullable: true, resolve: (server) => server.statusUrl }),
    authTokenId: t.int({ nullable: true, resolve: (server) => server.authTokenId }),
    // rconPassword: OMITTED — sensitive credential (RT-002)

    // Aggregate stats
    kills: t.exposeInt("kills"),
    players: t.exposeInt("players"),
    rounds: t.exposeInt("rounds"),
    suicides: t.exposeInt("suicides"),
    headshots: t.exposeInt("headshots"),
    bombsPlanted: t.exposeInt("bombsPlanted"),
    bombsDefused: t.exposeInt("bombsDefused"),
    ctWins: t.exposeInt("ctWins"),
    tsWins: t.exposeInt("tsWins"),
    maxPlayers: t.exposeInt("maxPlayers"),
    activePlayers: t.exposeInt("activePlayers"),
    activeMap: t.exposeString("activeMap"),
    mapRounds: t.exposeInt("mapRounds"),
    mapCtWins: t.exposeInt("mapCtWins"),
    mapTsWins: t.exposeInt("mapTsWins"),
    mapStarted: t.exposeInt("mapStarted"),
    mapChanges: t.exposeInt("mapChanges"),
    ctShots: t.exposeInt("ctShots"),
    ctHits: t.exposeInt("ctHits"),
    tsShots: t.exposeInt("tsShots"),
    tsHits: t.exposeInt("tsHits"),
    mapCtShots: t.exposeInt("mapCtShots"),
    mapCtHits: t.exposeInt("mapCtHits"),
    mapTsShots: t.exposeInt("mapTsShots"),
    mapTsHits: t.exposeInt("mapTsHits"),

    // Geolocation
    lat: t.float({ nullable: true, resolve: (server) => server.lat }),
    lng: t.float({ nullable: true, resolve: (server) => server.lng }),
    city: t.exposeString("city"),
    country: t.exposeString("country"),
    lastEvent: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (server) => server.lastEvent,
    }),

    // Relations
    authToken: t.relation("authToken", { nullable: true }),
    eventsAdmin: t.relation("eventsAdmin"),
    eventsChangeName: t.relation("eventsChangeName"),
    eventsChangeRole: t.relation("eventsChangeRole"),
    eventsChangeTeam: t.relation("eventsChangeTeam"),
    eventsChat: t.relation("eventsChat"),
    eventsConnect: t.relation("eventsConnect"),
    eventsDisconnect: t.relation("eventsDisconnect"),
    eventsEntry: t.relation("eventsEntry"),
    eventsFrag: t.relation("eventsFrag"),
    eventsLatency: t.relation("eventsLatency"),
    eventsPlayerAction: t.relation("eventsPlayerAction"),
    eventsPlayerPlayerAction: t.relation("eventsPlayerPlayerAction"),
    eventsRcon: t.relation("eventsRcon"),
    eventsSuicide: t.relation("eventsSuicide"),
    eventsTeamBonus: t.relation("eventsTeamBonus"),
    eventsTeamkill: t.relation("eventsTeamkill"),
    configs: t.relation("configs"),
    loads: t.relation("loads"),
    notificationConfig: t.relation("notificationConfig", { nullable: true }),
  }),
})
