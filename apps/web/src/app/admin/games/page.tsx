import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { AdminTable } from "@/features/admin/common/components/data-table"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import {
  GET_GAMES_WITH_PAGINATION,
  GET_GAME_COUNT,
} from "@/features/admin/games/graphql/game-queries"
import {
  parseUrlParams,
  buildPaginationVariables,
  buildCountVariables,
} from "@/features/common/graphql/pagination"

export const metadata: Metadata = {
  title: "Manage Games - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage supported games and their configurations.",
}

export default async function GamesPage(props: AdminPageProps) {
  const searchParams = await props.searchParams

  // Parse URL parameters using shared utility
  const params = parseUrlParams(searchParams, {
    sortField: "name",
    sortOrder: "asc",
    pageSize: 10,
  })

  // Build GraphQL variables using shared utility
  const queryVariables = buildPaginationVariables(params, ["name", "code"])
  const countVariables = buildCountVariables(params, ["name", "code"])

  // Fetch data on server
  const { data } = await query({
    query: GET_GAMES_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_GAME_COUNT,
    variables: countVariables,
  })

  const games = data.findManyGame || []
  const totalCount = countData.countGame || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/games" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Manage Games</h1>
              <p className="text-muted-foreground">
                Manage supported games and their configurations.
              </p>
            </div>
            <div>
              <Button variant="solid" colorScheme="green" size="sm">
                <Link href="/admin/games/add">Add Game</Link>
              </Button>
            </div>
          </div>
          <AdminTable
            tableType="games"
            data={games}
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
