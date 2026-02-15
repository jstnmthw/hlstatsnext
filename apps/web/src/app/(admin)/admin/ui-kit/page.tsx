import { AdminHeader } from "@/features/admin/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { KitchenSinkContent } from "@/features/ui-kit/components/kitchen-sink-content"
import { SidebarNavigation } from "@/features/ui-kit/components/sidebar-navigation"
import { tableOfContents } from "@/features/ui-kit/constants/table-of-contents"

export default function UIKitPage() {
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="container grid grid-cols-12 gap-10">
          <KitchenSinkContent className="col-span-9 pt-10" />
          <SidebarNavigation tableOfContents={tableOfContents} className="col-span-3" />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
