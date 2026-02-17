import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getServerById, isOnline, MOCK_PLAYERS } from "@/features/mock-data"
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from "@repo/ui"
import Link from "next/link"
import { notFound } from "next/navigation"

interface ServerPageProps {
  params: Promise<{ id: string }>
}

export default async function ServerPage({ params }: ServerPageProps) {
  const { id } = await params
  const serverId = parseInt(id, 10)
  if (isNaN(serverId) || serverId <= 0) notFound()

  const server = getServerById(serverId)
  if (!server) notFound()

  const online = isOnline(server.lastEvent)
  // Grab a subset of mock players as "recent players on this server"
  const recentPlayers = MOCK_PLAYERS.slice(0, 5)

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-3 w-3 rounded-full",
                  online ? "bg-primary-bright" : "bg-neutral-800",
                )}
              />
              <h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
              <Badge variant={online ? "primary" : "secondary"}>
                {online ? "Online" : "Offline"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Server Info</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-mono">
                    {server.address}:{server.port}
                  </dd>
                  <dt className="text-muted-foreground">Game</dt>
                  <dd>{server.game}</dd>
                  <dt className="text-muted-foreground">Current Map</dt>
                  <dd className="font-mono">{server.activeMap}</dd>
                  <dt className="text-muted-foreground">Players</dt>
                  <dd>
                    {server.activePlayers}/{server.maxPlayers}
                  </dd>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>
                    {server.city}, {server.country}
                  </dd>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Players</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Player</th>
                      <th className="pb-2 text-right font-medium">Skill</th>
                      <th className="pb-2 text-right font-medium">Kills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPlayers.map((player) => (
                      <tr
                        key={player.playerId}
                        className="border-b border-border last:border-0 hover:bg-accent/50"
                      >
                        <td className="py-2">
                          <Link
                            href={`/players/${player.playerId}`}
                            className="hover:text-primary-bright hover:underline"
                          >
                            {player.lastName}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {player.skill.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {player.kills.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
