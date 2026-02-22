import { AdminHeader } from "@/features/admin/common/components/header"
import { GET_GAMES_FOR_SELECT } from "@/features/admin/servers/graphql/game-queries"
import { TokenCreateForm } from "@/features/admin/tokens/components/token-create-form"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { query } from "@/lib/apollo-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui"

export const metadata = {
  title: "Create Token - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Generate a new authentication token for game server plugins.",
}

export default async function CreateTokenPage() {
  const { data } = await query({
    query: GET_GAMES_FOR_SELECT,
  })

  const games = data?.findManyGame || []

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/tokens/add" />
      <MainContent>
        <div className="container">
          <Card className="mx-auto mt-10 max-w-lg">
            <CardHeader>
              <CardTitle>Create Token</CardTitle>
              <CardDescription>
                Generate an authentication token for your game server plugin to connect to the
                daemon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TokenCreateForm games={games} />
            </CardContent>
          </Card>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
