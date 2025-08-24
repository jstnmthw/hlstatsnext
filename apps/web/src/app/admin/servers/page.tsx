import { AdminHeader } from "@/features/admin/servers/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { ServerList } from "@/features/homepage/components/server-list"
import { Button } from "@repo/ui"
import Link from "next/link"

export const metadata = {
  title: "Servers - Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game servers and track player statistics and activities.",
}

export default function ServersPage() {
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
            <ServerList />
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
