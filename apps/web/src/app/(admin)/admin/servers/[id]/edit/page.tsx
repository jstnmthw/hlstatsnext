import { AdminHeader } from "@/features/admin/common/components/header"
import { ServerEditForm } from "@/features/admin/servers/components/server-edit-form"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { listGameOptions } from "@/lib/data/games"
import { getServerForEdit, listModOptions } from "@/lib/data/servers"
import { Card } from "@repo/ui"
import { Metadata } from "next"
import { notFound } from "next/navigation"

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

  if (isNaN(serverId) || serverId <= 0) {
    notFound()
  }

  const [server, games, mods] = await Promise.all([
    getServerForEdit(serverId),
    listGameOptions(),
    listModOptions(),
  ])

  if (!server) {
    notFound()
  }

  return (
    <PageWrapper>
      <AdminHeader currentPath={`/admin/servers/${id}/edit`} />
      <MainContent>
        <div className="container">
          <div className="py-10">
            <Card className="mx-auto max-w-2xl p-6">
              <h1 className="mb-2 text-2xl font-bold tracking-tight uppercase">Edit Server</h1>
              <p className="mb-6 text-muted-foreground">
                Update server configuration and settings for {server.name || "Unnamed Server"}.
              </p>
              <ServerEditForm server={server} games={games} mods={mods} />
            </Card>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
