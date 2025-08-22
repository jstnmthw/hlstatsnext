import { AdminHeader } from "@/features/admin/components/header"
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
      <AdminHeader />
      <MainContent>
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-2">Admin Dashboard</h2>
          <p>
            Get started by creating your first Half-Life server to begin tracking player statistics
            and activities.
          </p>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
