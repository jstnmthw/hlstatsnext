import { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { query, PreloadQuery } from "@/lib/apollo-client"
import { AdminHeader } from "@/features/admin/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerEditForm } from "@/features/admin/servers/components/server-edit-form"
import { GET_SERVER_BY_ID } from "@/features/admin/servers/graphql/server-queries"
import { GET_GAMES_FOR_SELECT } from "@/features/admin/servers/graphql/game-queries"
import { Card } from "@repo/ui"

interface EditServerPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EditServerPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit Server ${id} - Admin - ${process.env.NEXT_PUBLIC_APP_NAME}`,
    description: "Edit game server configuration and settings.",
  }
}

export default async function EditServerPage({ params }: EditServerPageProps) {
  const { id } = await params
  const serverId = parseInt(id, 10)

  // Validate server ID
  if (isNaN(serverId) || serverId <= 0) {
    notFound()
  }

  // Fetch server data on server
  try {
    const { data } = await query({
      query: GET_SERVER_BY_ID,
      variables: { serverId },
    })

    const server = data.findUniqueServer

    if (!server) {
      notFound()
    }

    return (
      <PageWrapper>
        <AdminHeader currentPath={`/admin/servers/${id}/edit`} />
        <MainContent>
          <div className="container">
            <div className="py-10 border-t border-border">
              <Card className="p-6 max-w-2xl mx-auto">
                <h1 className="text-3xl font-medium tracking-tight mb-2">Edit Server</h1>
                <p className="text-muted-foreground mb-6 text-sm">
                  Update server configuration and settings for {server.name || "Unnamed Server"}.
                </p>
                <PreloadQuery query={GET_GAMES_FOR_SELECT}>
                  <Suspense fallback={<div>Loading...</div>}>
                    <ServerEditForm
                      server={{
                        serverId: server.serverId,
                        name: server.name || "",
                        address: server.address || "",
                        port: server.port || 27015,
                        game: server.game || "cstrike",
                        publicAddress: server.publicAddress || "",
                        statusUrl: server.statusUrl || "",
                        rconPassword: server.rconPassword || "",
                        connectionType: server.connectionType || "external",
                        dockerHost: server.dockerHost || "",
                        sortOrder: server.sortOrder || 0,
                      }}
                    />
                  </Suspense>
                </PreloadQuery>
              </Card>
            </div>
          </div>
        </MainContent>
        <Footer />
      </PageWrapper>
    )
  } catch (error) {
    console.error("Error fetching server:", error)
    notFound()
  }
}
