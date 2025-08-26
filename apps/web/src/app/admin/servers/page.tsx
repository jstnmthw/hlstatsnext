import Link from "next/link"
import { query } from "@/lib/apollo-client"
import { Button } from "@repo/ui"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/servers/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { GET_SERVERS_QUERY } from "@/features/common/graphql/servers"
import { ServerTable } from "@/features/admin/servers/components/server-table"

export const metadata = {
  title: "Manage Servers - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your game servers and track player statistics and activities.",
}

export default async function ServersPage() {
  const { data } = await query({ query: GET_SERVERS_QUERY })

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
            <ServerTable data={data.findManyServer} />
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
