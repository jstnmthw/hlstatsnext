import { Metadata } from "next"
import { notFound } from "next/navigation"
import { query } from "@/lib/apollo-client"
import { AdminHeader } from "@/features/admin/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerEditForm } from "@/features/admin/servers/components/server-edit-form"
import { GET_SERVER_BY_ID } from "@/features/admin/servers/graphql/server-queries"
import { GET_GAMES_FOR_SELECT } from "@/features/admin/servers/graphql/game-queries"
import { GET_MODS_FOR_SELECT } from "@/features/admin/servers/graphql/mod-queries"
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

  // Fetch server data, games, and mods on server
  try {
    const [serverResult, gamesResult, modsResult] = await Promise.all([
      query({
        query: GET_SERVER_BY_ID,
        variables: { serverId },
      }),
      query({
        query: GET_GAMES_FOR_SELECT,
      }),
      query({
        query: GET_MODS_FOR_SELECT,
      }),
    ])

    const server = serverResult.data?.findUniqueServer
    const games = gamesResult.data?.findManyGame || []
    const mods = modsResult.data?.findManyModSupported || []

    if (!server) {
      notFound()
    }

    // Extract the mod config value
    const modConfig = server.configs?.find((config) => config.parameter === "Mod")
    const currentMod = modConfig?.value || ""

    return (
      <PageWrapper>
        <AdminHeader currentPath={`/admin/servers/${id}/edit`} />
        <MainContent>
          <div className="container">
            <div className="py-10">
              <Card className="p-6 max-w-2xl mx-auto">
                <h1 className="text-3xl font-medium tracking-tight mb-2">Edit Server</h1>
                <p className="text-muted-foreground mb-6 text-sm">
                  Update server configuration and settings for {server.name || "Unnamed Server"}.
                </p>
                <ServerEditForm
                  server={{
                    serverId: Number(server.serverId),
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
                    mod: currentMod,
                  }}
                  games={games}
                  mods={mods}
                />
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
