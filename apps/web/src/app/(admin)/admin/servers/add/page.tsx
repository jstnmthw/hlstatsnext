import { query } from "@/lib/apollo-client"
import { AdminHeader } from "@/features/admin/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerCreateForm } from "@/features/admin/servers/components/server-create-form"
import { GET_GAMES_FOR_SELECT } from "@/features/admin/servers/graphql/game-queries"
import { GET_MODS_FOR_SELECT } from "@/features/admin/servers/graphql/mod-queries"
import { Card } from "@repo/ui"

export const metadata = {
  title: "Create Server - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Add a new game server to track player statistics and activities.",
}

export default async function CreateServerPage() {
  const [gamesResult, modsResult] = await Promise.all([
    query({
      query: GET_GAMES_FOR_SELECT,
    }),
    query({
      query: GET_MODS_FOR_SELECT,
    }),
  ])

  const games = gamesResult.data?.findManyGame || []
  const mods = modsResult.data?.findManyModSupported || []

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/servers/add" />
      <MainContent>
        <div className="container">
          <div className="py-10">
            <Card className="p-6 max-w-lg mx-auto">
              <h1 className="text-3xl font-medium tracking-tight mb-2">Add Server</h1>
              <p className="text-muted-foreground mb-6">
                Add a new Half-Life server to begin tracking player statistics and activities.
              </p>
              <ServerCreateForm games={games} mods={mods} />
            </Card>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
