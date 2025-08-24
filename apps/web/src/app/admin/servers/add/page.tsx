import { AdminHeader } from "@/features/admin/servers/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerCreateForm } from "@/features/admin/servers/components/server-create-form"
import { Card } from "@repo/ui"

export const metadata = {
  title: "Create Server - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Add a new game server to track player statistics and activities.",
}

export default function CreateServerPage() {
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="container">
          <div className="py-10 border-t border-border">
            <Card className="p-6 max-w-lg mx-auto">
              <h1 className="text-3xl font-medium tracking-tight mb-2">Add Server</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                Add a new Half-Life server to begin tracking player statistics and activities.
              </p>
              <ServerCreateForm />
            </Card>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
