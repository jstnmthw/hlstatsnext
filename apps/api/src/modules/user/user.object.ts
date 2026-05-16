/**
 * Custom User prismaObject for admin user management.
 * Replaces the auto-generated User object to omit the auth-internal relations
 * (sessions, accounts) managed by Better Auth — those expose credential/token
 * data and their Session/Account object types are intentionally not registered.
 * Exposed via admin-gated queries only (see pothos-schema.ts).
 */
import { builder } from "../../builder"

builder.prismaObject("User", {
  findUnique: ({ id }) => ({ id }),
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    email: t.exposeString("email"),
    emailVerified: t.exposeBoolean("emailVerified"),
    image: t.exposeString("image", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (user) => user.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (user) => user.updatedAt }),
    role: t.exposeString("role", { nullable: true }),
    banned: t.exposeBoolean("banned", { nullable: true }),
    banReason: t.exposeString("banReason", { nullable: true }),
    banExpires: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (user) => user.banExpires,
    }),
    // sessions, accounts: OMITTED — auth internals managed by Better Auth
  }),
})
