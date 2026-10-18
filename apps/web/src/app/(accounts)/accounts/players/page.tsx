import { MyPlayers } from "@/features/accounts/components/my-players"
import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { myPlayers } from "@/lib/data/my-players"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "My Players - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "The players matched to your Steam account.",
}

export default async function MyPlayersPage() {
  const { players, steamLinked } = await myPlayers()

  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight uppercase">My Players</h1>
          <p className="text-muted-foreground">
            One player per game you have played, matched to your Steam account.
          </p>
        </div>
        <MyPlayers players={players} steamLinked={steamLinked} />
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
