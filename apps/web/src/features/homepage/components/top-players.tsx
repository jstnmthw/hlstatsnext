import { GET_PLAYERS_WITH_PAGINATION } from "@/features/admin/players/graphql/player-queries"
import { query } from "@/lib/apollo-client"
import { SortOrder } from "@/lib/gql/graphql"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle, cn, IconTrophy } from "@repo/ui"
import Link from "next/link"
import { ComponentProps } from "react"

const trophyColors = ["text-amber-400", "text-zinc-400", "text-amber-700"] as const

export async function TopPlayers({ className, ...props }: ComponentProps<"div">) {
  const { data } = await query({
    query: GET_PLAYERS_WITH_PAGINATION,
    variables: {
      take: 5,
      orderBy: [{ skill: SortOrder.Desc }],
    },
  })

  const players = data?.findManyPlayer ?? []

  return (
    <Card className={cn("overflow-hidden px-6", className)} {...props}>
      <CardHeader className="px-0">
        <CardTitle>Top Players</CardTitle>
        <CardDescription>Highest skilled players across all servers</CardDescription>
      </CardHeader>
      <div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Player</th>
              <th className="pb-2 text-right font-medium">Skill</th>
              <th className="pb-2 text-right font-medium">K/D</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => {
              const deaths = player.deaths || 1
              const kd = (player.kills / deaths).toFixed(2)
              return (
                <tr
                  key={player.playerId}
                  className="border-b border-border last:border-0 hover:bg-accent/50"
                >
                  <td className="py-2 text-muted-foreground">{i + 1}.</td>
                  <td className="py-2 font-medium">
                    <Link
                      href={`/players/${player.playerId}`}
                      className="inline-flex h-4 items-center hover:text-primary-bright hover:underline"
                    >
                      {i < 3 && <IconTrophy className={cn("mr-1.5 size-4", trophyColors[i])} />}
                      {player.lastName}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums">{player.skill.toLocaleString()}</td>
                  <td className="py-2 text-right text-muted-foreground tabular-nums">{kd}</td>
                </tr>
              )
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No players found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CardFooter className="justify-end px-0">
        <Link
          href="/players"
          className="text-xs text-muted-foreground hover:text-primary-bright hover:underline"
        >
          View all players &rarr;
        </Link>
      </CardFooter>
    </Card>
  )
}
