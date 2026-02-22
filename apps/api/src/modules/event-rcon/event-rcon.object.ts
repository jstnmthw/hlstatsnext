/**
 * Custom EventRcon prismaObject that omits the password field.
 * Replaces the auto-generated EventRcon object to prevent credential exposure (RT-002, RT-008).
 */
import { builder } from "../../builder"

builder.prismaObject("EventRcon", {
  findUnique: ({ id }) => ({ id }),
  fields: (t) => ({
    id: t.exposeInt("id"),
    eventTime: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (event) => event.eventTime,
    }),
    serverId: t.exposeInt("serverId"),
    map: t.exposeString("map"),
    type: t.exposeString("type"),
    remoteIp: t.exposeString("remoteIp"),
    // password: OMITTED — sensitive credential (RT-002, RT-008)
    command: t.exposeString("command"),
    server: t.relation("server"),
  }),
})
