import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"

export const metadata = {
  title: "Welcome to " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-24 bg-muted"></div>
          <div className="col-span-1 h-24 bg-muted"></div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
