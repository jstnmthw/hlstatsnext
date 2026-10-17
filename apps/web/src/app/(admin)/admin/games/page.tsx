import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminGamesTable } from "@/features/admin/games/components/admin-games-table"
import { gameTableConfig } from "@/features/admin/games/components/game-columns"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getConfigDefaults, parseUrlParams } from "@/features/common/graphql/pagination"
import { listGames } from "@/lib/data/games"
import { Button, IconDeviceGamepad2 } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Manage Games - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage supported games and their configurations.",
}

export default async function GamesPage(props: AdminPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(gameTableConfig),
    gameTableConfig.filters,
  )

  const { games, totalCount } = await listGames(params)

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/games" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase">Manage Games</h1>
              <p className="text-muted-foreground">
                Manage supported games and their configurations.
              </p>
            </div>
            <div>
              <Button
                asChild
                variant="solid"
                size="default"
                colorScheme="green"
                className="pl-2.5!"
              >
                <Link href="/admin/games/add">
                  <IconDeviceGamepad2 data-slot="icon" />
                  <span>Add game</span>
                </Link>
              </Button>
            </div>
          </div>
          <AdminGamesTable data={games} totalCount={totalCount} />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
