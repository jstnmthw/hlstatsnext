import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getGameByCode, MOCK_PLAYERS, MOCK_SERVERS } from "@/features/mock-data"
import { Badge, Card, CardContent, CardHeader, CardTitle, cn, IconTrophy } from "@repo/ui"
import Link from "next/link"
import { notFound } from "next/navigation"

const trophyColors = ["text-amber-400", "text-zinc-400", "text-amber-700"] as const

interface GamePageProps {
  params: Promise<{ code: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { code } = await params
  const game = getGameByCode(code)
  if (!game) notFound()

  const gameServers = MOCK_SERVERS.filter((s) => s.game === game.code)
  const totalPlayers = gameServers.reduce((sum, s) => sum + s.activePlayers, 0)
  // Use a subset of mock players as "top players for this game"
  const topPlayers = MOCK_PLAYERS.slice(0, 5)

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{game.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">{game.code.toUpperCase()}</Badge>
              <Badge variant="outline">{game.realgame}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Servers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{gameServers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Players Online</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{totalPlayers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Engine</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{game.realgame}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Players</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Player</th>
                    <th className="pb-2 text-right font-medium">Skill</th>
                    <th className="pb-2 text-right font-medium">Kills</th>
                    <th className="pb-2 text-right font-medium">K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((player, i) => {
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
                            {i < 3 && (
                              <IconTrophy className={cn("mr-1.5 size-4", trophyColors[i])} />
                            )}
                            {player.lastName}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {player.skill.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {player.kills.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-muted-foreground tabular-nums">{kd}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
