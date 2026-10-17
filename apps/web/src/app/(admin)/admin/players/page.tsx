import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminPlayersTable } from "@/features/admin/players/components/admin-players-table"
import { playerTableConfig } from "@/features/admin/players/components/player-columns"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getConfigDefaults, parseUrlParams } from "@/features/common/graphql/pagination"
import { listPlayers } from "@/lib/data/players"
import { Button, IconUser } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Manage Players - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game players and track their statistics and activities.",
}

export default async function PlayersPage(props: AdminPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(searchParams, getConfigDefaults(playerTableConfig))

  const { players, totalCount } = await listPlayers(params)

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/players" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase">Manage Players</h1>
              <p className="text-muted-foreground">
                Manage your game players and track their statistics and activities.
              </p>
            </div>
            <div>
              <Button
                variant="solid"
                size="default"
                colorScheme="green"
                asChild
                className="pl-2.5!"
              >
                <Link href="/admin/players/add">
                  <IconUser data-slot="icon" />
                  <span>Add player</span>
                </Link>
              </Button>
            </div>
          </div>
          <AdminPlayersTable data={players} totalCount={totalCount} />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
