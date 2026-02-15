import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerList } from "@/features/homepage/components/server-list"
import { TopPlayers } from "@/features/homepage/components/top-players"
import { VersionAnnounce } from "@/features/homepage/components/version-announce"
import { Card } from "@repo/ui"

export const metadata = {
  title: "Welcome to " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="col-span-full self-start px-6 md:col-span-2">
            <ServerList className="border-0" />
          </Card>
          <div className="col-span-full flex flex-col gap-4 md:col-span-1">
            <TopPlayers />
            <VersionAnnounce />
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
