import { AdminHeader } from "@/features/admin/common/components/header"
import { ServerCreateForm } from "@/features/admin/servers/components/server-create-form"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { listGameOptions } from "@/lib/data/games"
import { listModOptions } from "@/lib/data/servers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui"

export const metadata = {
  title: "Create Server - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Add a new game server to track player statistics and activities.",
}

export default async function CreateServerPage() {
  const [games, mods] = await Promise.all([listGameOptions(), listModOptions()])

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/servers/add" />
      <MainContent>
        <div className="container">
          <Card className="mx-auto mt-10 max-w-lg">
            <CardHeader>
              <CardTitle>Add Server</CardTitle>
              <CardDescription>
                Add a new Half-Life server to begin tracking player statistics and activities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServerCreateForm games={games} mods={mods} />
            </CardContent>
          </Card>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
