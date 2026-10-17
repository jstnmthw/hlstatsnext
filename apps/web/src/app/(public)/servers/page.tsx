import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getConfigDefaults, parseUrlParams } from "@/features/common/graphql/pagination"
import { serverPageTableConfig } from "@/features/servers/components/server-config"
import { ServersTable } from "@/features/servers/components/servers-table"
import { listPublicServers } from "@/lib/data/public/servers"

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

  const { servers, totalCount } = await listPublicServers(params)

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mt-8 mb-8">
          <h1 className="text-2xl font-bold tracking-tight uppercase">Servers</h1>
          <p className="text-muted-foreground">Browse all tracked game servers</p>
        </div>
        <ServersTable data={servers} totalCount={totalCount} />
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
