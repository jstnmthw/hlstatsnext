import { builder } from "../builder"
import { handleGraphQLResult, handleGraphQLResultNullable } from "../utils/graphql-result-handler"
import type { Prisma } from "@repo/database/client"

// Define PlayerAward type first since Award references it
const PlayerAward = builder.prismaObject("PlayerAward", {
  fields: (t) => ({
    awardTime: t.field({
      type: "String",
      resolve: (parent) => parent.awardTime.toISOString(),
    }),
    count: t.exposeInt("count"),
    game: t.exposeString("game"),

    // Relations
    award: t.relation("award"),
    player: t.relation("player"),
  }),
})

// Define Award type using Prisma object
const Award = builder.prismaObject("Award", {
  fields: (t) => ({
    id: t.exposeInt("awardId"),
    awardType: t.exposeString("awardType"),
    game: t.exposeString("game"),
    code: t.exposeString("code"),
    name: t.exposeString("name"),
    verb: t.exposeString("verb"),

    // Relations
    dailyWinner: t.relation("d_winner", { nullable: true }),
    dailyWinnerCount: t.exposeInt("d_winner_count", { nullable: true }),
    globalWinner: t.relation("g_winner", { nullable: true }),
    globalWinnerCount: t.exposeInt("g_winner_count", { nullable: true }),

    // Computed field for top recipients
    topRecipients: t.field({
      type: [PlayerAward],
      resolve: async (award, _args, context) => {
        return context.db.playerAward.findMany({
          where: { awardId: award.awardId },
          include: { player: true },
          orderBy: { count: "desc" },
          take: 10,
        })
      },
    }),
  }),
})

// Define PaginatedAwards type
const PaginatedAwards = builder.objectRef<{
  items: {
    awardId: number
    awardType: string
    game: string
    code: string
    name: string
    verb: string
    d_winner_id: number | null
    d_winner_count: number | null
    g_winner_id: number | null
    g_winner_count: number | null
  }[]
  total: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}>("PaginatedAwards")

PaginatedAwards.implement({
  fields: (t) => ({
    items: t.field({
      type: [Award],
      resolve: (parent) => parent.items,
    }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    totalPages: t.exposeInt("totalPages"),
    hasNextPage: t.exposeBoolean("hasNextPage"),
    hasPreviousPage: t.exposeBoolean("hasPreviousPage"),
  }),
})

// Award queries
builder.queryFields((t) => ({
  // Get all awards with pagination
  awards: t.field({
    type: PaginatedAwards,
    args: {
      game: t.arg.string({ required: false }),
      awardType: t.arg.string({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.award.getAwards({
        game: args.game ?? undefined,
        awardType: args.awardType ?? undefined,
        page: args.page ?? 1,
        limit: Math.min(args.limit ?? 20, 100), // Cap at 100
      })
      return handleGraphQLResult(result)
    },
  }),

  // Get single award by ID
  award: t.field({
    type: Award,
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.award.getAwardById(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),

  // Get awards for a specific game
  gameAwards: t.field({
    type: [Award],
    args: {
      game: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.award.getGameAwards(args.game)
      return handleGraphQLResult(result)
    },
  }),
}))

// Define input types for mutations
const AwardCreateInput = builder.inputType("AwardCreateInput", {
  fields: (t) => ({
    awardType: t.string({ required: true }),
    game: t.string({ required: true }),
    code: t.string({ required: true }),
    name: t.string({ required: true }),
    verb: t.string({ required: true }),
  }),
})

const AwardUpdateInput = builder.inputType("AwardUpdateInput", {
  fields: (t) => ({
    awardType: t.string({ required: false }),
    name: t.string({ required: false }),
    verb: t.string({ required: false }),
  }),
})

// Award mutations
builder.mutationFields((t) => ({
  // Create a new award
  createAward: t.field({
    type: Award,
    args: {
      input: t.arg({ type: AwardCreateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.AwardCreateInput = {
        awardType: args.input.awardType,
        game: args.input.game,
        code: args.input.code,
        name: args.input.name,
        verb: args.input.verb,
      }

      const result = await context.services.award.createAward(input)
      return handleGraphQLResult(result)
    },
  }),

  // Update an award
  updateAward: t.field({
    type: Award,
    args: {
      id: t.arg.int({ required: true }),
      input: t.arg({ type: AwardUpdateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.AwardUpdateInput = {
        ...(args.input.awardType && { awardType: args.input.awardType }),
        ...(args.input.name && { name: args.input.name }),
        ...(args.input.verb && { verb: args.input.verb }),
      }

      const result = await context.services.award.updateAward(args.id, input)
      return handleGraphQLResult(result)
    },
  }),

  // Delete an award
  deleteAward: t.field({
    type: "Boolean",
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.award.deleteAward(args.id)
      return handleGraphQLResult(result)
    },
  }),
}))
