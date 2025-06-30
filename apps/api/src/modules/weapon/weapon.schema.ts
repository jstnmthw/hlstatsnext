import { builder } from "@/builder"
import { handleGraphQLResult, handleGraphQLResultNullable } from "@/shared/utils/graphql-result-handler"
import type { Weapon, Prisma } from "@repo/database/client"

// Define Weapon type using Prisma object
const WeaponType = builder.prismaObject("Weapon", {
  fields: (t) => ({
    id: t.exposeInt("weaponId"),
    game: t.exposeString("game"),
    code: t.exposeString("code"),
    name: t.exposeString("name"),
    modifier: t.exposeFloat("modifier"),
    kills: t.exposeInt("kills"),
    headshots: t.exposeInt("headshots"),

    // Computed fields
    headshotRatio: t.field({
      type: "Float",
      resolve: (weapon) => {
        return weapon.kills > 0 ? (weapon.headshots / weapon.kills) * 100 : 0
      },
    }),

    effectiveness: t.field({
      type: "Float",
      resolve: (weapon) => {
        // Simple effectiveness calculation based on modifier and usage
        return weapon.modifier * (weapon.kills > 0 ? Math.log(weapon.kills + 1) : 1)
      },
    }),
  }),
})

// Define PaginatedWeapons type
const PaginatedWeapons = builder.objectRef<{
  items: Weapon[]
  total: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}>("PaginatedWeapons")

PaginatedWeapons.implement({
  fields: (t) => ({
    items: t.field({
      type: [WeaponType],
      resolve: (parent) => parent.items,
    }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    totalPages: t.exposeInt("totalPages"),
    hasNextPage: t.exposeBoolean("hasNextPage"),
    hasPreviousPage: t.exposeBoolean("hasPreviousPage"),
  }),
})

// Weapon queries
builder.queryFields((t) => ({
  // Get all weapons with pagination
  weapons: t.field({
    type: PaginatedWeapons,
    args: {
      game: t.arg.string({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.weapon.getWeapons({
        game: args.game ?? undefined,
        page: args.page ?? 1,
        limit: Math.min(args.limit ?? 20, 100), // Cap at 100
      })
      return handleGraphQLResult(result)
    },
  }),

  // Get single weapon by ID
  weapon: t.field({
    type: WeaponType,
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.weapon.getWeaponById(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),

  // Get weapons for a specific game
  gameWeapons: t.field({
    type: [WeaponType],
    args: {
      game: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.weapon.getGameWeapons(args.game)
      return handleGraphQLResult(result)
    },
  }),

  // Get weapon statistics (top weapons)
  weaponStatistics: t.field({
    type: [WeaponType],
    args: {
      game: t.arg.string({ required: false }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.weapon.getWeaponStatistics({
        game: args.game ?? undefined,
        limit: args.limit ?? 10,
      })
      return handleGraphQLResult(result)
    },
  }),
}))

// Define input types for mutations
const WeaponCreateInput = builder.inputType("WeaponCreateInput", {
  fields: (t) => ({
    game: t.string({ required: true }),
    code: t.string({ required: true }),
    name: t.string({ required: true }),
    modifier: t.float({ required: false, defaultValue: 1.0 }),
  }),
})

const WeaponUpdateInput = builder.inputType("WeaponUpdateInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    modifier: t.float({ required: false }),
  }),
})

// Weapon mutations
builder.mutationFields((t) => ({
  // Create a new weapon
  createWeapon: t.field({
    type: WeaponType,
    args: {
      input: t.arg({ type: WeaponCreateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.WeaponCreateInput = {
        game: args.input.game,
        code: args.input.code,
        name: args.input.name,
        modifier: args.input.modifier ?? 1.0,
      }

      const result = await context.services.weapon.createWeapon(input)
      return handleGraphQLResult(result)
    },
  }),

  // Update a weapon
  updateWeapon: t.field({
    type: WeaponType,
    args: {
      id: t.arg.int({ required: true }),
      input: t.arg({ type: WeaponUpdateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.WeaponUpdateInput = {
        ...(args.input.name && { name: { set: args.input.name } }),
        ...(args.input.modifier !== undefined && {
          modifier: { set: args.input.modifier ?? undefined },
        }),
      }

      const result = await context.services.weapon.updateWeapon(args.id, input)
      return handleGraphQLResult(result)
    },
  }),

  // Delete a weapon
  deleteWeapon: t.field({
    type: "Boolean",
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.weapon.deleteWeapon(args.id)
      return handleGraphQLResult(result)
    },
  }),
}))
