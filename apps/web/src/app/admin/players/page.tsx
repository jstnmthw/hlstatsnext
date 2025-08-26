import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/servers/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { PlayerTable } from "@/features/admin/players/components/player-table"
import { GET_PLAYERS_QUERY } from "@/features/admin/players/graphql/player-queries"

export const metadata: Metadata = {
  title: "Manage Players - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game players and track their statistics and activities.",
}

export default async function PlayersPage() {
  const { data } = await query({ query: GET_PLAYERS_QUERY })
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="container">
          <div className="border-t border-border">
            <div className="mt-8 mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-medium tracking-tight">Manage Players</h1>
                <p className="text-muted-foreground">
                  Manage your game players and track their statistics and activities.
                </p>
              </div>
              <div>
                <Button variant="solid" colorScheme="green" size="sm">
                  <Link href="/admin/servers/add">Add Server</Link>
                </Button>
              </div>
            </div>
            <PlayerTable data={data.findManyPlayer} />
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
