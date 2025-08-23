import { SidebarNavigation } from "@/features/ui-kit/components/sidebar-navigation"
import { KitchenSinkContent } from "@/features/ui-kit/components/kitchen-sink-content"
import { tableOfContents } from "@/features/ui-kit/constants/table-of-contents"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { AdminHeader } from "@/features/admin/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { Footer } from "@/features/common/components/footer"

export default function UIKitPage() {
  return (
    <PageWrapper>
      <AdminHeader className="border-b border-border" isFixed fullWidth />
      <MainContent fixedHeader>
        <SidebarNavigation tableOfContents={tableOfContents} />
        <div className="ml-64">
          <KitchenSinkContent />
        </div>
      </MainContent>
      <div className="ml-64">
        <Footer />
      </div>
    </PageWrapper>
  )
}
