import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { Navbar } from "@/features/admin/common/components/navbar"
import { PlayerDataTable } from "@/features/admin/players/components/player-data-table"
import {
  GET_PLAYERS_WITH_PAGINATION,
  GET_PLAYER_COUNT,
} from "@/features/admin/players/graphql/player-queries"
import {
  parseUrlParams,
  buildPaginationVariables,
  buildCountVariables,
} from "@/features/common/graphql/pagination"

export const metadata: Metadata = {
  title: "Manage Players - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game players and track their statistics and activities.",
}

interface PlayersPageProps {
  searchParams: Promise<{
    page?: string
    sortField?: string
    sortOrder?: string
    search?: string
  }>
}

export default async function PlayersPage(props: PlayersPageProps) {
  const searchParams = await props.searchParams

  // Parse URL parameters using shared utility
  const params = parseUrlParams(searchParams, {
    sortField: "lastName",
    sortOrder: "asc",
    pageSize: 10,
  })

  // Build GraphQL variables using shared utility
  const queryVariables = buildPaginationVariables(params, ["lastName", "email"])
  const countVariables = buildCountVariables(params, ["lastName", "email"])

  // Fetch data on server
  const { data } = await query({
    query: GET_PLAYERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_PLAYER_COUNT,
    variables: countVariables,
  })

  const players = data.findManyPlayer || []
  const totalCount = countData.countPlayer || 0

  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <Navbar />
        <div className="container">
          <div className="mt-8 mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Manage Players</h1>
              <p className="text-muted-foreground">
                Manage your game players and track their statistics and activities.
              </p>
            </div>
            <div>
              <Button variant="solid" colorScheme="green" size="sm">
                <Link href="/admin/servers/add">Add Server</Link>
              </Button>
            </div>
          </div>
          <PlayerDataTable
            data={players}
            totalCount={totalCount}
            currentPage={params.page}
            pageSize={params.pageSize}
            sortField={params.sortField}
            sortOrder={params.sortOrder}
            search={params.search}
          />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
