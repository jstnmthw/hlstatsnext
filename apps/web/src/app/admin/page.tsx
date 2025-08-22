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
        <div className="max-w-screen-lg mx-auto py-10 border-t border-border">
          <h2 className="text-3xl font-semibold tracking-tight mb-2">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Get started by creating your first Half-Life server to begin tracking player statistics
            and activities.
          </p>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
