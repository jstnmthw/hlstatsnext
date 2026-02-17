import { AdminHeader } from "@/features/admin/common/components/header"
import { PermissionGate } from "@/features/auth/components/permission-gate"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { Button, Card, IconCirclePlus, IconServer } from "@repo/ui"
import Link from "next/link"

export const metadata = {
  title: "Admin - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin" />
      <MainContent>
        <div className="container">
          <div className="py-10">
            <h2 className="text-3xl font-bold tracking-tight uppercase">Admin Dashboard</h2>
            <p className="text-muted-foreground">
              Get started by creating your first Half-Life server to begin tracking player
              statistics and activities.
            </p>
          </div>
          <Card className="flex flex-col items-center gap-4 border-dashed py-10">
            <div className="rounded-full bg-accent p-4">
              <IconServer className="size-6" />
            </div>
            <div className="flex max-w-xs flex-col items-center gap-2 text-center">
              <h3 className="text-lg font-semibold">No servers configured</h3>
              <p className="mb-4 text-muted-foreground">
                Add your first Half-Life server to begin tracking player statistics and activities.
              </p>
              <PermissionGate permissions={{ server: ["create"] }}>
                <Button variant="solid" size="default" colorScheme="green" asChild>
                  <Link href="/admin/servers/add">
                    <IconCirclePlus data-slot="icon" />
                    <span>Add server</span>
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </Card>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
