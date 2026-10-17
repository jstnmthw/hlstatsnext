/**
 * Players a signed-in user has claimed through Steam. The UserPlayer model has
 * no auto-generated CRUD; these are the only two ways to reach it.
 */
import { hasPermission } from "@repo/auth/permissions"
import { GraphQLError } from "graphql"
import { builder } from "../../builder"
import { requireAuth } from "../../context"

const UpdateMyPlayerInput = builder.inputType("UpdateMyPlayerInput", {
  fields: (t) => ({
    hideRanking: t.boolean({ required: false }),
    displayEvents: t.boolean({ required: false }),
    blockAvatar: t.boolean({ required: false }),
  }),
})

// The legacy columns are 0/1 integers; an omitted field leaves the column alone.
function toFlag(value: boolean | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  return value ? 1 : 0
}

builder.queryField("myPlayers", (t) =>
  t.prismaField({
    type: ["Player"],
    description: "The players the signed-in user has claimed through Steam.",
    resolve: async (query, _root, _args, ctx) => {
      const session = requireAuth(ctx)
      const claims = await ctx.prisma.userPlayer.findMany({
        where: { userId: session.user.id },
        select: { playerId: true },
      })
      if (claims.length === 0) return []
      return ctx.prisma.player.findMany({
        ...query,
        where: { playerId: { in: claims.map((claim) => claim.playerId) } },
        orderBy: { lastEvent: "desc" },
      })
    },
  }),
)

builder.mutationField("updateMyPlayer", (t) =>
  t.prismaField({
    type: "Player",
    description: "Set the ranking, event and avatar preferences of one of your own players.",
    args: {
      playerId: t.arg.int({ required: true }),
      data: t.arg({ type: UpdateMyPlayerInput, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const session = requireAuth(ctx)
      if (!hasPermission(session.user.role, { player: ["update-own"] })) {
        throw new GraphQLError("Not allowed to update players", {
          extensions: { code: "FORBIDDEN" },
        })
      }

      const claim = await ctx.prisma.userPlayer.findUnique({ where: { playerId: args.playerId } })
      if (!claim || claim.userId !== session.user.id) {
        throw new GraphQLError("This player is not yours", { extensions: { code: "FORBIDDEN" } })
      }

      return ctx.prisma.player.update({
        ...query,
        where: { playerId: args.playerId },
        data: {
          hideRanking: toFlag(args.data.hideRanking),
          displayEvents: toFlag(args.data.displayEvents),
          blockAvatar: toFlag(args.data.blockAvatar),
        },
      })
    },
  }),
)
