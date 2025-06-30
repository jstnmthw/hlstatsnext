import { builder } from "@/builder"
import { handleGraphQLResult, handleGraphQLResultNullable } from "@/shared/utils/graphql-result-handler"
import type { Action, Prisma } from "@repo/database/client"

// Define Action type using Prisma object
const Action = builder.prismaObject("Action", {
  fields: (t) => ({
    id: t.exposeInt("id"),
    game: t.exposeString("game"),
    code: t.exposeString("code"),
    rewardPlayer: t.exposeInt("reward_player"),
    rewardTeam: t.exposeInt("reward_team"),
    team: t.exposeString("team"),
    description: t.exposeString("description", { nullable: true }),
    forPlayerActions: t.exposeString("for_PlayerActions"),
    forPlayerPlayerActions: t.exposeString("for_PlayerPlayerActions"),
    forTeamActions: t.exposeString("for_TeamActions"),
    forWorldActions: t.exposeString("for_WorldActions"),
    count: t.exposeInt("count"),
  }),
})

// Define PaginatedActions type
const PaginatedActions = builder.objectRef<{
  items: Action[]
  total: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}>("PaginatedActions")

PaginatedActions.implement({
  fields: (t) => ({
    items: t.field({
      type: [Action],
      resolve: (parent) => parent.items,
    }),
    total: t.exposeInt("total"),
    page: t.exposeInt("page"),
    totalPages: t.exposeInt("totalPages"),
    hasNextPage: t.exposeBoolean("hasNextPage"),
    hasPreviousPage: t.exposeBoolean("hasPreviousPage"),
  }),
})

// Action queries
builder.queryFields((t) => ({
  // Get all actions with pagination
  actions: t.field({
    type: PaginatedActions,
    args: {
      game: t.arg.string({ required: false }),
      team: t.arg.string({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.action.getActions({
        game: args.game ?? undefined,
        team: args.team ?? undefined,
        page: args.page ?? 1,
        limit: Math.min(args.limit ?? 20, 100), // Cap at 100
      })
      return handleGraphQLResult(result)
    },
  }),

  // Get single action by ID
  action: t.field({
    type: Action,
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.action.getActionById(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),

  // Get actions for a specific game
  gameActions: t.field({
    type: [Action],
    args: {
      game: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.action.getGameActions(args.game)
      return handleGraphQLResult(result)
    },
  }),
}))

// Define input types for mutations
const ActionCreateInput = builder.inputType("ActionCreateInput", {
  fields: (t) => ({
    game: t.string({ required: true }),
    code: t.string({ required: true }),
    rewardPlayer: t.int({ required: false, defaultValue: 10 }),
    rewardTeam: t.int({ required: false, defaultValue: 0 }),
    team: t.string({ required: false, defaultValue: "" }),
    description: t.string({ required: false }),
    forPlayerActions: t.string({ required: false, defaultValue: "0" }),
    forPlayerPlayerActions: t.string({ required: false, defaultValue: "0" }),
    forTeamActions: t.string({ required: false, defaultValue: "0" }),
    forWorldActions: t.string({ required: false, defaultValue: "0" }),
  }),
})

const ActionUpdateInput = builder.inputType("ActionUpdateInput", {
  fields: (t) => ({
    rewardPlayer: t.int({ required: false }),
    rewardTeam: t.int({ required: false }),
    description: t.string({ required: false }),
    forPlayerActions: t.string({ required: false }),
    forPlayerPlayerActions: t.string({ required: false }),
    forTeamActions: t.string({ required: false }),
    forWorldActions: t.string({ required: false }),
  }),
})

// Action mutations
builder.mutationFields((t) => ({
  // Create a new action
  createAction: t.field({
    type: Action,
    args: {
      input: t.arg({ type: ActionCreateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.ActionCreateInput = {
        game: args.input.game,
        code: args.input.code,
        reward_player: args.input.rewardPlayer ?? 10,
        reward_team: args.input.rewardTeam ?? 0,
        team: args.input.team ?? "",
        description: args.input.description ?? undefined,
        for_PlayerActions: args.input.forPlayerActions ?? "0",
        for_PlayerPlayerActions: args.input.forPlayerPlayerActions ?? "0",
        for_TeamActions: args.input.forTeamActions ?? "0",
        for_WorldActions: args.input.forWorldActions ?? "0",
      }

      const result = await context.services.action.createAction(input)
      return handleGraphQLResult(result)
    },
  }),

  // Update an action
  updateAction: t.field({
    type: Action,
    args: {
      id: t.arg.int({ required: true }),
      input: t.arg({ type: ActionUpdateInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const input: Prisma.ActionUpdateInput = {
        ...(args.input.rewardPlayer !== undefined && {
          reward_player: {
            set: args.input.rewardPlayer ?? undefined,
          },
        }),
        ...(args.input.rewardTeam !== undefined && {
          reward_team: {
            set: args.input.rewardTeam ?? undefined,
          },
        }),
        ...(args.input.description && { description: args.input.description }),
        ...(args.input.forPlayerActions && {
          for_PlayerActions: {
            set: args.input.forPlayerActions,
          },
        }),
        ...(args.input.forPlayerPlayerActions && {
          for_PlayerPlayerActions: {
            set: args.input.forPlayerPlayerActions ?? undefined,
          },
        }),
        ...(args.input.forTeamActions && {
          for_TeamActions: {
            set: args.input.forTeamActions ?? undefined,
          },
        }),
        ...(args.input.forWorldActions && {
          for_WorldActions: {
            set: args.input.forWorldActions ?? undefined,
          },
        }),
      }

      const result = await context.services.action.updateAction(args.id, input)
      return handleGraphQLResult(result)
    },
  }),

  // Delete an action
  deleteAction: t.field({
    type: "Boolean",
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.action.deleteAction(args.id)
      return handleGraphQLResult(result)
    },
  }),
}))
