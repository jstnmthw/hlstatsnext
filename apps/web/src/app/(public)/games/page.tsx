import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { MOCK_GAMES, MOCK_SERVERS } from "@/features/mock-data"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui"
import Link from "next/link"

export const metadata = {
  title: "Games",
  description: "Browse all tracked games",
}

export default function GamesPage() {
  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Games</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_GAMES.map((game) => {
            const serverCount = MOCK_SERVERS.filter((s) => s.game === game.code).length
            return (
              <Link key={game.code} href={`/games/${game.code}`}>
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <CardTitle>{game.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{game.code.toUpperCase()}</Badge>
                      <Badge variant="outline">{game.realgame}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {serverCount} {serverCount === 1 ? "server" : "servers"} tracked
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
