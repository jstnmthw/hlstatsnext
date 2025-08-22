import { Header } from "@/features/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"

export const metadata = {
  title: "Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <Header />
      <MainContent>
        <div className="grid grid-cols-3 gap-4">Admin Content</div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
