import { GET_SERVER_BY_ID } from "@/features/servers/graphql/servers-queries"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { notFound } from "next/navigation"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"

interface ServerPageProps {
  params: Promise<{ id: string }>
}

export default async function ServerPage({ params }: ServerPageProps) {
  const { id } = await params

  // Validate and convert ID to integer
  const serverId = parseInt(id, 10)
  if (isNaN(serverId) || serverId <= 0) {
    notFound()
  }

  try {
    // Fetch data on server with correct variable name
    const { data } = await query({
      query: GET_SERVER_BY_ID,
      variables: { serverId },
    })

    if (!data?.findUniqueServer) {
      notFound()
    }

    return (
      <PageWrapper>
        <Header />
        <MainContent className="container">
          <div className="py-10 border-t border-border">
            <h1 className="text-2xl font-semibold tracking-tight">{data.findUniqueServer.name}</h1>
          </div>
        </MainContent>
        <Footer />
      </PageWrapper>
    )
  } catch (error) {
    console.error("Failed to fetch server:", error)
    notFound()
  }
}
