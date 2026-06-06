import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  buildCountVariables,
  buildPaginationVariables,
  getConfigDefaults,
  parseUrlParams,
} from "@/features/common/graphql/pagination"
import { playerPageTableConfig } from "@/features/players/components/player-config"
import { PlayersTable } from "@/features/players/components/players-table"
import {
  GET_PUBLIC_PLAYER_COUNT,
  GET_PUBLIC_PLAYERS_WITH_PAGINATION,
  withHumanFilter,
} from "@/features/players/graphql/player-queries"
import { query } from "@/lib/apollo-client"

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

  const baseQueryVariables = buildPaginationVariables(params, playerPageTableConfig.searchFields)
  const baseCountVariables = buildCountVariables(params, playerPageTableConfig.searchFields)

  // Hide bots by default; ?showBots=true opts back in.
  const showBots = searchParams.showBots === "true"
  const queryVariables = {
    ...baseQueryVariables,
    where: withHumanFilter(baseQueryVariables.where, showBots),
  }
  const countVariables = {
    ...baseCountVariables,
    where: withHumanFilter(baseCountVariables.where, showBots),
  }

  const { data } = await query({
    query: GET_PUBLIC_PLAYERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_PUBLIC_PLAYER_COUNT,
    variables: countVariables,
  })

  const players = data?.findManyPlayer ?? []
  const totalCount = countData?.countPlayer ?? 0

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mt-8 mb-8">
          <h1 className="text-2xl font-bold tracking-tight uppercase">Players</h1>
          <p className="text-muted-foreground">Browse all ranked players</p>
        </div>
        <PlayersTable data={players} totalCount={totalCount} />
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
