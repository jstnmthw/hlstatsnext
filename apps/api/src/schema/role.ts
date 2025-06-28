import { builder } from "../builder"
import { handleGraphQLResult, handleGraphQLResultNullable } from "../utils/graphql-result-handler"
import type { Role, Prisma } from "@repo/database/client"

// Define Role type using Prisma object
const RoleType = builder.prismaObject("Role", {
  fields: (t) => ({
    id: t.exposeInt("roleId"),
    game: t.exposeString("game"),
    code: t.exposeString("code"),
    name: t.exposeString("name"),
    hidden: t.field({
      type: "Boolean",
      resolve: (role) => role.hidden === "1",
    }),
    picked: t.exposeInt("picked"),
    kills: t.exposeInt("kills"),
    deaths: t.exposeInt("deaths"),

    // Computed fields
    killDeathRatio: t.field({
      type: "Float",
      resolve: (role) => {
        return role.deaths > 0 ? role.kills / role.deaths : role.kills
      },
    }),
  }),
})

// Define PaginatedRoles type
const PaginatedRoles = builder.objectRef<{
  items: Role[]
  total: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}>("PaginatedRoles")

PaginatedRoles.implement({
  fields: (t) => ({
    items: t.field({
      type: [RoleType],
      resolve: (parent) => parent.items,
    }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    totalPages: t.exposeInt("totalPages"),
    hasNextPage: t.exposeBoolean("hasNextPage"),
    hasPreviousPage: t.exposeBoolean("hasPreviousPage"),
  }),
})

// Role queries
builder.queryFields((t) => ({
  // Get all roles with pagination
  roles: t.field({
    type: PaginatedRoles,
    args: {
      game: t.arg.string({ required: false }),
      hidden: t.arg.boolean({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.role.getRoles({
        game: args.game ?? undefined,
        hidden: args.hidden ?? undefined,
        page: args.page ?? 1,
        limit: Math.min(args.limit ?? 20, 100),
      })
      return handleGraphQLResult(result)
    },
  }),

  // Get single role by ID
  role: t.field({
    type: RoleType,
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.role.getRoleById(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),

  // Get roles for a specific game
  gameRoles: t.field({
    type: [RoleType],
    args: {
      game: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.role.getGameRoles(args.game)
      return handleGraphQLResult(result)
    },
  }),

  // Get role statistics (most picked roles)
  roleStatistics: t.field({
    type: [RoleType],
    args: {
      game: t.arg.string({ required: false }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.role.getRoleStatistics({
        game: args.game ?? undefined,
        limit: args.limit ?? 10,
      })
      return handleGraphQLResult(result)
    },
  }),
}))

// Define input types for mutations
const RoleCreateInput = builder.inputType("RoleCreateInput", {
  fields: (t) => ({
    game: t.string({ required: true }),
    code: t.string({ required: true }),
    name: t.string({ required: true }),
    hidden: t.boolean({ required: false, defaultValue: false }),
  }),
})

const RoleUpdateInput = builder.inputType("RoleUpdateInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    hidden: t.boolean({ required: false }),
  }),
})

// Role mutations
builder.mutationFields((t) => ({
  // Create a new role
  createRole: t.field({
    type: RoleType,
    args: {
      input: t.arg({ type: RoleCreateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.RoleCreateInput = {
        game: args.input.game,
        code: args.input.code,
        name: args.input.name,
        hidden: args.input.hidden ? "1" : "0",
      }

      const result = await context.services.role.createRole(input)
      return handleGraphQLResult(result)
    },
  }),

  // Update a role
  updateRole: t.field({
    type: RoleType,
    args: {
      id: t.arg.int({ required: true }),
      input: t.arg({ type: RoleUpdateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.RoleUpdateInput = {
        ...(args.input.name && { name: { set: args.input.name } }),
        ...(args.input.hidden !== undefined && {
          hidden: { set: args.input.hidden ? "1" : "0" },
        }),
      }

      const result = await context.services.role.updateRole(args.id, input)
      return handleGraphQLResult(result)
    },
  }),

  // Delete a role
  deleteRole: t.field({
    type: "Boolean",
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.role.deleteRole(args.id)
      return handleGraphQLResult(result)
    },
  }),
}))
