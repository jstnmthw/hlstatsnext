import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminServersTable } from "@/features/admin/servers/components/admin-servers-table"
import { serverTableConfig } from "@/features/admin/servers/components/server-columns"
import {
  GET_SERVER_COUNT,
  GET_SERVERS_WITH_PAGINATION,
} from "@/features/admin/servers/graphql/server-queries"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  buildCountVariables,
  buildPaginationVariables,
  FilterTransform,
  getConfigDefaults,
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

const serverFilterTransforms: Record<string, FilterTransform> = {
  status: (values) => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const wantOnline = values.includes("online")
    const wantOffline = values.includes("offline")

    if (wantOnline && !wantOffline) {
      return { lastEvent: { gt: thirtyMinAgo } }
    }
    if (wantOffline && !wantOnline) {
      return {
        OR: [{ lastEvent: { lt: thirtyMinAgo } }, { lastEvent: null }],
      }
    }
    return undefined // both selected = no filter
  },
}

export default async function ServersPage(props: AdminPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(serverTableConfig),
    serverTableConfig.filters,
  )

  const queryVariables = buildPaginationVariables(
    params,
    serverTableConfig.searchFields,
    serverFilterTransforms,
  )
  const countVariables = buildCountVariables(
    params,
    serverTableConfig.searchFields,
    serverFilterTransforms,
  )

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
              <h1 className="text-2xl font-bold tracking-tight uppercase">Manage Servers</h1>
              <p className="text-muted-foreground">
                Manage your game servers and track player statistics and activities.
              </p>
            </div>
            <Button variant="solid" size="default" colorScheme="green" asChild className="pl-2.5!">
              <Link href="/admin/servers/add">
                <IconServer data-slot="icon" />
                <span>Add server</span>
              </Link>
            </Button>
          </div>
          <AdminServersTable data={servers} totalCount={totalCount} />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
