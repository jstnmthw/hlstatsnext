import { AdminHeader } from "@/features/admin/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerCreateForm } from "@/features/admin/components/server-create-form"
import { Card } from "@repo/ui/card"

export const metadata = {
  title: "Create Server - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Add a new game server to track player statistics and activities.",
}

export default function CreateServerPage() {
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="max-w-screen-lg mx-auto py-10 border-t border-border">
          <div className="mb-8">
            <h1 className="text-3xl font-medium tracking-tight">Create Server</h1>
            <p className="text-muted-foreground">
              Add a new Half-Life server to begin tracking player statistics and activities.
            </p>
          </div>
          
          <Card className="p-6">
            <ServerCreateForm />
          </Card>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}