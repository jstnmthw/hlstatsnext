import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerHeader } from "@/features/servers/components/server-header"
import { ServerPlayerTable } from "@/features/servers/components/server-player-table"
import { GET_SERVER_BASIC_INFO } from "@/features/servers/graphql/server-player-queries"
import { parseUrlParams } from "@/features/common/graphql/pagination"

interface ServerPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: ServerPageProps): Promise<Metadata> {
  const { id } = await params
  const serverId = parseInt(id, 10)

  if (isNaN(serverId)) {
    return {
      title: "Server Not Found",
    }
  }

  try {
    const { data } = await query({
      query: GET_SERVER_BASIC_INFO,
      variables: { serverId },
    })

    const server = data?.findUniqueServer

    return {
      title: server?.name ? `${server.name} - Server Stats` : `Server #${serverId} - Stats`,
      description: server
        ? `View player statistics and leaderboard for ${server.name} (${server.address}:${server.port})`
        : `View player statistics for server #${serverId}`,
    }
  } catch {
    return {
      title: "Server Stats",
      description: "View server statistics and player leaderboard",
    }
  }
}

export default async function ServerPage({ params, searchParams }: ServerPageProps) {
  const { id } = await params
  const searchParamsData = await searchParams
  const serverId = parseInt(id, 10)

  if (isNaN(serverId)) {
    console.error("Server ID is not a number", id)
    notFound()
  }

  // Parse URL parameters for table state
  const urlParams = parseUrlParams(searchParamsData as Record<string, string | undefined>, {
    sortField: "skill",
    sortOrder: "desc",
    pageSize: 25,
  })

  // Verify server exists
  try {
    const { data } = await query({
      query: GET_SERVER_BASIC_INFO,
      variables: { serverId },
    })

    if (!data?.findUniqueServer) {
      console.error("Server not found", serverId)
      notFound()
    }
  } catch (error) {
    console.error("Error fetching server basic info", serverId)
    console.error(error)
    notFound()
  }

  return (
    <PageWrapper>
      <Header />
      <MainContent>
        <div className="container py-8">
          {/* Server Header */}
          <Suspense
            fallback={<div className="animate-pulse h-48 bg-gray-200 rounded-lg mb-8"></div>}
          >
            <ServerHeader serverId={serverId} className="mb-8" />
          </Suspense>

          {/* Navigation Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8 border-b border-border">
              <a
                href={`/servers/${serverId}`}
                className="border-b-2 border-blue-500 py-2 px-1 text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Players
              </a>
              <a
                href={`/servers/${serverId}/maps`}
                className="border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Maps
              </a>
              <a
                href={`/servers/${serverId}/history`}
                className="border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                History
              </a>
            </nav>
          </div>

          {/* Players Table */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Player Leaderboard</h2>
              <p className="text-muted-foreground">
                Rankings and statistics for players on this server
              </p>
            </div>

            <Suspense
              fallback={
                <div className="animate-pulse">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="h-20 bg-gray-200 rounded-lg"></div>
                    <div className="h-20 bg-gray-200 rounded-lg"></div>
                    <div className="h-20 bg-gray-200 rounded-lg"></div>
                  </div>
                  <div className="h-96 bg-gray-200 rounded-lg"></div>
                </div>
              }
            >
              <ServerPlayerTable
                serverId={serverId}
                currentPage={urlParams.page}
                pageSize={urlParams.pageSize}
                sortField={urlParams.sortField}
                sortOrder={urlParams.sortOrder}
                searchValue={urlParams.search}
              />
            </Suspense>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
