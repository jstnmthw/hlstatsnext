import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminPlayersTable } from "@/features/admin/players/components/admin-players-table"
import {
  GET_PLAYERS_WITH_PAGINATION,
  GET_PLAYER_COUNT,
} from "@/features/admin/players/graphql/player-queries"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  buildCountVariables,
  buildPaginationVariables,
  parseUrlParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { Button, IconUser } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Manage Players - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game players and track their statistics and activities.",
}

export default async function PlayersPage(props: AdminPageProps) {
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

  const players = data?.findManyPlayer || []
  const totalCount = countData?.countPlayer || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/players" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight uppercase">Manage Players</h1>
              <p className="text-muted-foreground">
                Manage your game players and track their statistics and activities.
              </p>
            </div>
            <div>
              <Button
                variant="solid"
                size="default"
                colorScheme="green"
                asChild
                className="pl-2.5!"
              >
                <Link href="/admin/players/add">
                  <IconUser data-slot="icon" />
                  <span>Add player</span>
                </Link>
              </Button>
            </div>
          </div>
          <AdminPlayersTable
            data={players}
            totalCount={totalCount}
            currentPage={params.page}
            pageSize={params.pageSize}
            sortField={params.sortField}
            sortOrder={params.sortOrder}
            searchValue={params.search}
          />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
