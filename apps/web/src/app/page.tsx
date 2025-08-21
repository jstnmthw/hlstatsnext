import { Header } from "@/features/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerList } from "@/features/homepage/components/server-list"

export const metadata = {
  title: "Welcome to " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <Header />
      <MainContent>
        <div className="grid grid-cols-3 gap-4">
          <ServerList className="col-span-2" />
          <div className="col-span-1">
            <div className="gap-2 border rounded-lg p-4">
              <h2 className="text-md font-bold mb-1">Latest News</h2>
              <p className="text-xs text-zinc-400">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
              </p>
            </div>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
