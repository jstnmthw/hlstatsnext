import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/servers/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { PlayerDataTable } from "@/features/admin/players/components/player-data-table"
import {
  GET_PLAYERS_WITH_PAGINATION,
  GET_PLAYER_COUNT,
} from "@/features/admin/players/graphql/player-queries"

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

  // Parse URL parameters
  const page = Number(searchParams.page) || 1
  const pageSize = 10
  const sortField = searchParams.sortField || "lastName"
  const sortOrder = (searchParams.sortOrder as "asc" | "desc") || "asc"
  const search = searchParams.search || ""

  // Build GraphQL variables
  const queryVariables: Record<string, unknown> = {
    take: pageSize,
    skip: (page - 1) * pageSize,
  }

  if (sortField) {
    queryVariables.orderBy = [{ [sortField]: sortOrder }]
  }

  if (search) {
    queryVariables.where = {
      OR: [{ lastName: { contains: search } }, { email: { contains: search } }],
    }
  }

  const countVariables: Record<string, unknown> = {}
  if (search) {
    countVariables.where = queryVariables.where
  }

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
        <div className="container">
          <div className="border-t border-border">
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
              currentPage={page}
              pageSize={pageSize}
              sortField={sortField}
              sortOrder={sortOrder}
              search={search}
            />
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
