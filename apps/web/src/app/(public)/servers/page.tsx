import {
  GET_SERVERS_WITH_PAGINATION,
  GET_SERVER_COUNT,
} from "@/features/admin/servers/graphql/server-queries"
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
import { serverPageTableConfig } from "@/features/servers/components/server-config"
import { ServersTable } from "@/features/servers/components/servers-table"
import { query } from "@/lib/apollo-client"

export const metadata = {
  title: "Servers",
  description: "Browse all tracked game servers",
}

interface ServersPageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    sortField?: string
    sortOrder?: string
    search?: string
    [key: string]: string | undefined
  }>
}

export default async function ServersPage(props: ServersPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(serverPageTableConfig),
    serverPageTableConfig.filters,
  )

  const queryVariables = buildPaginationVariables(params, serverPageTableConfig.searchFields)

  // Add secondary sort by name for stable ordering (e.g. 0-player servers alphabetical)
  if (queryVariables.orderBy) {
    queryVariables.orderBy.push({ name: "asc" })
  }
  const countVariables = buildCountVariables(params, serverPageTableConfig.searchFields)

  const { data } = await query({
    query: GET_SERVERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_SERVER_COUNT,
    variables: countVariables,
  })

  const servers = data?.findManyServer ?? []
  const totalCount = countData?.countServer ?? 0

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mt-8 mb-8">
          <h1 className="text-3xl font-bold tracking-tight uppercase">Servers</h1>
          <p className="text-muted-foreground">Browse all tracked game servers</p>
        </div>
        <ServersTable data={servers} totalCount={totalCount} />
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
