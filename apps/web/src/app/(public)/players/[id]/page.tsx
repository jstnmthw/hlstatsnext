import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getPlayerById, MOCK_SERVERS } from "@/features/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui"
import Link from "next/link"
import { notFound } from "next/navigation"

interface PlayerPageProps {
  params: Promise<{ id: string }>
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params
  const playerId = parseInt(id, 10)
  if (isNaN(playerId) || playerId <= 0) notFound()

  const player = getPlayerById(playerId)
  if (!player) notFound()

  const kd = (player.kills / (player.deaths || 1)).toFixed(2)
  const hsPercent = ((player.headshots / (player.kills || 1)) * 100).toFixed(1)
  const lastActive = player.lastEvent ? new Date(player.lastEvent).toLocaleString() : "Never"

  // Mock recent servers for this player
  const recentServers = MOCK_SERVERS.slice(0, 4)

  const stats = [
    { label: "Skill", value: player.skill.toLocaleString() },
    { label: "Kills", value: player.kills.toLocaleString() },
    { label: "Deaths", value: player.deaths.toLocaleString() },
    { label: "K/D Ratio", value: kd },
    { label: "Headshots", value: player.headshots.toLocaleString() },
    { label: "Headshot %", value: `${hsPercent}%` },
  ]

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{player.lastName}</h1>
            <p className="text-sm text-muted-foreground">
              Last active: {lastActive} &middot; {player.country}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Servers</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Server</th>
                    <th className="pb-2 font-medium">Map</th>
                    <th className="pb-2 text-right font-medium">Players</th>
                    <th className="pb-2 text-right font-medium">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {recentServers.map((server) => (
                    <tr
                      key={server.serverId}
                      className="border-b border-border last:border-0 hover:bg-accent/50"
                    >
                      <td className="py-2">
                        <Link
                          href={`/servers/${server.serverId}`}
                          className="hover:text-primary-bright hover:underline"
                        >
                          {server.name}
                        </Link>
                      </td>
                      <td className="py-2 font-mono">{server.activeMap}</td>
                      <td className="py-2 text-right tabular-nums">
                        {server.activePlayers}/{server.maxPlayers}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {server.address}:{server.port}
                      </td>
                    </tr>
                  ))}
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
