import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { AdminServersTable } from "@/features/admin/servers/components/admin-servers-table"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import {
  GET_SERVERS_WITH_PAGINATION,
  GET_SERVER_COUNT,
} from "@/features/admin/servers/graphql/server-queries"
import {
  parseUrlParams,
  buildPaginationVariables,
  buildCountVariables,
} from "@/features/common/graphql/pagination"

export const metadata: Metadata = {
  title: "Manage Servers - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game servers and track player statistics and activities.",
}

export default async function ServersPage(props: AdminPageProps) {
  const searchParams = await props.searchParams

  // Parse URL parameters using shared utility
  const params = parseUrlParams(searchParams, {
    sortField: "name",
    sortOrder: "asc",
    pageSize: 10,
  })

  // Build GraphQL variables using shared utility
  const queryVariables = buildPaginationVariables(params, ["name", "address", "game"])
  const countVariables = buildCountVariables(params, ["name", "address", "game"])

  // Fetch data on server
  const { data } = await query({
    query: GET_SERVERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_SERVER_COUNT,
    variables: countVariables,
  })

  const servers = data.findManyServer || []
  const totalCount = countData.countServer || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/servers" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Manage Servers</h1>
              <p className="text-muted-foreground">
                Manage your game servers and track player statistics and activities.
              </p>
            </div>
            <div>
              <Button variant="solid" colorScheme="green" size="sm">
                <Link href="/admin/servers/add">Add Server</Link>
              </Button>
            </div>
          </div>
          <AdminServersTable
            data={servers}
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
