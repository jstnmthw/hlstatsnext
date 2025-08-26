import Link from "next/link"
import { Button } from "@repo/ui"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/servers/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"

export const metadata = {
  title: "Manage Servers - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game servers and track player statistics and activities.",
}

export default async function ServersPage() {
  return (
    <PageWrapper>
      <AdminHeader />
      <MainContent>
        <div className="container">
          <div className="border-t border-border">
            <div className="mt-8 mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-medium tracking-tight">Servers</h1>
                <p className="text-muted-foreground">
                  Manage your game servers and track player statistics and activities.
                </p>
              </div>
              <div>
                <Button variant="solid" colorScheme="green" size="sm">
                  <Link href="/admin/servers/add">Add Server</Link>
                </Button>
              </div>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Server table temporarily disabled
            </div>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
