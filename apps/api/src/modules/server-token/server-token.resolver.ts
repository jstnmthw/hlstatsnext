/**
 * ServerToken GraphQL Resolver
 *
 * Defines GraphQL types, queries, and mutations for server token management.
 * Tokens are used for game server authentication with the daemon.
 */

import type { ServerToken } from "@repo/db/client"
import { builder } from "../../builder"
import { requireAdmin } from "../../context"

// Helper to strip rconPassword from token
function stripRconPassword<T extends { rconPassword?: unknown }>(
  token: T,
): Omit<T, "rconPassword"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rconPassword, ...safeToken } = token
  return safeToken
}

// Input type for creating tokens
const CreateServerTokenInput = builder.inputType("CreateServerTokenInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    rconPassword: t.string({ required: false }),
    game: t.string({ required: true }),
    expiresAt: t.field({ type: "DateTime", required: false }),
  }),
})

// Input type for revoking tokens
const RevokeServerTokenInput = builder.inputType("RevokeServerTokenInput", {
  fields: (t) => ({
    id: t.int({ required: true }),
  }),
})

// ServerToken Prisma type (hides rconPassword, adds computed fields)
// Using prismaObject ensures compatibility with Server.authToken relation
builder.prismaObject("ServerToken", {
  // Exclude rconPassword and tokenHash (sensitive fields)
  fields: (t) => ({
    id: t.exposeInt("id"),
    tokenPrefix: t.exposeString("tokenPrefix"),
    name: t.exposeString("name"),
    game: t.exposeString("game"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    expiresAt: t.expose("expiresAt", { type: "DateTime", nullable: true }),
    revokedAt: t.expose("revokedAt", { type: "DateTime", nullable: true }),
    lastUsedAt: t.expose("lastUsedAt", { type: "DateTime", nullable: true }),
    createdBy: t.exposeString("createdBy"),
    // Relation to servers
    servers: t.relation("servers"),
    serverCount: t.relationCount("servers"),
    // Computed status field
    status: t.string({
      resolve: (token) => {
        if (token.revokedAt) return "revoked"
        if (token.expiresAt && token.expiresAt < new Date()) return "expired"
        return "active"
      },
    }),
    // Indicates whether RCON password is configured (without exposing it)
    hasRconPassword: t.boolean({
      description: "Whether this token has an RCON password configured",
      resolve: (token) => Boolean(token.rconPassword),
    }),
  }),
})

// Type for safe token in custom result types (without rconPassword)
type SafeServerToken = Omit<ServerToken, "rconPassword" | "tokenHash"> & {
  _count?: { servers: number }
}

// Simple object ref for use in result types (not Prisma object)
const SafeServerTokenRef = builder.objectRef<SafeServerToken>("SafeServerToken")

SafeServerTokenRef.implement({
  fields: (t) => ({
    id: t.exposeInt("id"),
    tokenPrefix: t.exposeString("tokenPrefix"),
    name: t.exposeString("name"),
    game: t.exposeString("game"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    expiresAt: t.expose("expiresAt", { type: "DateTime", nullable: true }),
    revokedAt: t.expose("revokedAt", { type: "DateTime", nullable: true }),
    lastUsedAt: t.expose("lastUsedAt", { type: "DateTime", nullable: true }),
    createdBy: t.exposeString("createdBy"),
    serverCount: t.int({
      resolve: (token) => token._count?.servers ?? 0,
    }),
    status: t.string({
      resolve: (token) => {
        if (token.revokedAt) return "revoked"
        if (token.expiresAt && token.expiresAt < new Date()) return "expired"
        return "active"
      },
    }),
    hasRconPassword: t.boolean({
      description: "Whether this token has an RCON password configured",
      resolve: () => false, // Service layer doesn't include rconPassword
    }),
  }),
})

// Result type for create operation (includes rawToken)
const CreateServerTokenResult = builder.objectRef<{
  success: boolean
  message: string
  rawToken: string | null
  token: SafeServerToken | null
}>("CreateServerTokenResult")

CreateServerTokenResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    message: t.exposeString("message"),
    rawToken: t.exposeString("rawToken", {
      nullable: true,
      description: "The raw token value. Only returned once on creation - store it securely!",
    }),
    token: t.field({
      type: SafeServerTokenRef,
      nullable: true,
      resolve: (result) => result.token,
    }),
  }),
})

// Result type for revoke operation
const RevokeServerTokenResult = builder.objectRef<{
  success: boolean
  message: string
  token: SafeServerToken | null
}>("RevokeServerTokenResult")

RevokeServerTokenResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    message: t.exposeString("message"),
    token: t.field({
      type: SafeServerTokenRef,
      nullable: true,
      resolve: (result) => result.token,
    }),
  }),
})

// Query: Find many tokens (uses Prisma relation-aware type)
builder.queryField("findManyServerToken", (t) =>
  t.prismaField({
    type: ["ServerToken"],
    args: {
      includeRevoked: t.arg.boolean({ required: false, defaultValue: false }),
      skip: t.arg.int({ required: false }),
      take: t.arg.int({ required: false }),
    },
    resolve: async (query, _root, { includeRevoked, skip, take }, context) => {
      requireAdmin(context)

      return context.services.serverToken.findManyPrisma({
        ...query,
        where: includeRevoked ? {} : { revokedAt: null },
        skip: skip ?? undefined,
        take: take ?? undefined,
      })
    },
  }),
)

// Query: Count tokens
builder.queryField("countServerToken", (t) =>
  t.int({
    args: {
      includeRevoked: t.arg.boolean({ required: false, defaultValue: false }),
    },
    resolve: async (_root, { includeRevoked }, context) => {
      requireAdmin(context)
      return context.services.serverToken.count(includeRevoked ?? false)
    },
  }),
)

// Query: Find single token by ID (uses Prisma relation-aware type)
builder.queryField("findServerToken", (t) =>
  t.prismaField({
    type: "ServerToken",
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (query, _root, { id }, context) => {
      requireAdmin(context)
      return context.services.serverToken.findByIdPrisma(id, query)
    },
  }),
)

// Mutation: Create token
builder.mutationField("createServerToken", (t) =>
  t.field({
    type: CreateServerTokenResult,
    args: {
      input: t.arg({ type: CreateServerTokenInput, required: true }),
    },
    resolve: async (_root, { input }, context) => {
      const session = requireAdmin(context)

      const result = await context.services.serverToken.createToken({
        name: input.name,
        rconPassword: input.rconPassword ?? undefined,
        game: input.game,
        expiresAt: input.expiresAt ?? null,
        createdBy: session.user.id,
      })

      if (!result.success || !result.token) {
        return {
          success: false,
          message: result.message,
          rawToken: null,
          token: null,
        }
      }

      return {
        success: true,
        message: result.message,
        rawToken: result.rawToken,
        token: stripRconPassword(result.token),
      }
    },
  }),
)

// Mutation: Revoke token
builder.mutationField("revokeServerToken", (t) =>
  t.field({
    type: RevokeServerTokenResult,
    args: {
      input: t.arg({ type: RevokeServerTokenInput, required: true }),
    },
    resolve: async (_root, { input }, context) => {
      requireAdmin(context)

      const result = await context.services.serverToken.revokeToken(input.id)

      if (!result.success || !result.token) {
        return {
          success: false,
          message: result.message,
          token: null,
        }
      }

      return {
        success: true,
        message: result.message,
        token: stripRconPassword(result.token),
      }
    },
  }),
)
