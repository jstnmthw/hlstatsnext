/**
 * Custom EventConnect prismaObject that omits per-session network identifiers
 * (ipAddress, hostname, hostgroup). Replaces the auto-generated object to
 * prevent bulk pivot from IP to player and vice-versa.
 */
import { builder } from "../../builder"

builder.prismaObject("EventConnect", {
  findUnique: ({ id }) => ({ id }),
  fields: (t) => ({
    id: t.exposeInt("id"),
    eventTime: t.expose("eventTime", { type: "DateTime", nullable: true }),
    serverId: t.exposeInt("serverId"),
    map: t.exposeString("map"),
    playerId: t.exposeInt("playerId"),
    // ipAddress: OMITTED — sensitive PII (player IP)
    // hostname:  OMITTED — sensitive PII (player hostname)
    // hostgroup: OMITTED — sensitive PII (player hostgroup)
    eventTimeDisconnect: t.expose("eventTimeDisconnect", {
      type: "DateTime",
      nullable: true,
    }),
    player: t.relation("player"),
    server: t.relation("server"),
  }),
})
