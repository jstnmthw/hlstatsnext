import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminServersTable } from "@/features/admin/servers/components/admin-servers-table"
import {
  GET_SERVERS_WITH_PAGINATION,
  GET_SERVER_COUNT,
} from "@/features/admin/servers/graphql/server-queries"
import { PermissionGate } from "@/features/auth/components/permission-gate"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  buildCountVariables,
  buildPaginationVariables,
  parseUrlParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { Button, IconServer } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

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

  const servers = data?.findManyServer || []
  const totalCount = countData?.countServer || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/servers" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight uppercase">Manage Servers</h1>
              <p className="text-muted-foreground">
                Manage your game servers and track player statistics and activities.
              </p>
            </div>
            <PermissionGate permissions={{ server: ["create"] }}>
              <Button
                variant="solid"
                size="default"
                colorScheme="green"
                asChild
                className="pl-2.5!"
              >
                <Link href="/admin/servers/add">
                  <IconServer data-slot="icon" />
                  <span>Add server</span>
                </Link>
              </Button>
            </PermissionGate>
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
