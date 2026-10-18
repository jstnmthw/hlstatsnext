import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getConfigDefaults, parseUrlParams } from "@/features/common/graphql/pagination"
import { playerPageTableConfig } from "@/features/players/components/player-config"
import { PlayersTable } from "@/features/players/components/players-table"
import { listPublicPlayers } from "@/lib/data/public/players"

export const metadata = {
  title: "Players",
  description: "Browse all ranked players",
}

interface PlayersPageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    sortField?: string
    sortOrder?: string
    search?: string
    [key: string]: string | undefined
  }>
}

export default async function PlayersPage(props: PlayersPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(playerPageTableConfig),
    playerPageTableConfig.filters,
  )

  // Hide bots by default; ?showBots=true opts back in.
  const { players, totalCount } = await listPublicPlayers(params, {
    showBots: searchParams.showBots === "true",
  })

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight uppercase">Players</h1>
          <p className="text-muted-foreground">Browse all ranked players</p>
        </div>
        <PlayersTable data={players} totalCount={totalCount} />
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
