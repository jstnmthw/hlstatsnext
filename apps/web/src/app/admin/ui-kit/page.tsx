import { SidebarNavigation } from "@/features/ui-kit/components/sidebar-navigation"
import { KitchenSinkContent } from "@/features/ui-kit/components/kitchen-sink-content"
import { tableOfContents } from "@/features/ui-kit/constants/table-of-contents"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { AdminHeader } from "@/features/admin/servers/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { Footer } from "@/features/common/components/footer"

export default function UIKitPage() {
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="grid grid-cols-12 container gap-10">
          <KitchenSinkContent className="col-span-9 pt-10" />
          <SidebarNavigation tableOfContents={tableOfContents} className="col-span-3" />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
