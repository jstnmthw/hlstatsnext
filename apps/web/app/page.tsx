import { Header } from "@/features/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"

export default function Page() {
  return (
    <PageWrapper>
      <Header fixed />
      <MainContent fixedHeader>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9 border">Main content</div>
          <div className="col-span-3 border">Sidebar</div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
