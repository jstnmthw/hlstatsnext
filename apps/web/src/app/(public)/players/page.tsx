import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { MOCK_PLAYERS } from "@/features/mock-data"
import { Card, CardContent, CardHeader, CardTitle, cn, IconTrophy } from "@repo/ui"
import Link from "next/link"

const trophyColors = ["text-amber-400", "text-zinc-400", "text-amber-700"] as const

export const metadata = {
  title: "Players",
  description: "Browse all ranked players",
}

export default function PlayersPage() {
  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>All Players</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Rank</th>
                  <th className="pb-2 font-medium">Player</th>
                  <th className="pb-2 text-right font-medium">Skill</th>
                  <th className="pb-2 text-right font-medium">Kills</th>
                  <th className="pb-2 text-right font-medium">Deaths</th>
                  <th className="pb-2 text-right font-medium">K/D</th>
                  <th className="pb-2 text-right font-medium">Headshots</th>
                  <th className="pb-2 text-right font-medium">Country</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PLAYERS.map((player, i) => {
                  const kd = (player.kills / (player.deaths || 1)).toFixed(2)
                  return (
                    <tr
                      key={player.playerId}
                      className="border-b border-border last:border-0 hover:bg-accent/50"
                    >
                      <td className="py-2 text-muted-foreground">{i + 1}.</td>
                      <td className="py-2 font-medium">
                        <Link
                          href={`/players/${player.playerId}`}
                          className="inline-flex items-center hover:text-primary-bright hover:underline"
                        >
                          {i < 3 && <IconTrophy className={cn("mr-1.5 size-4", trophyColors[i])} />}
                          {player.lastName}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {player.skill.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {player.kills.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {player.deaths.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-muted-foreground tabular-nums">{kd}</td>
                      <td className="py-2 text-right tabular-nums">
                        {player.headshots.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{player.country}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
