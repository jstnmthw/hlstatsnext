import { AdminHeader } from "@/features/admin/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { Button } from "@repo/ui/button"
import { Card } from "@repo/ui/card"
import { PlusCircleIcon, ServerIcon } from "lucide-react"
import Link from "next/link"

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
          <h2 className="text-2xl font-medium tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Get started by creating your first Half-Life server to begin tracking player statistics
            and activities.
          </p>
        </div>
        <Card className="flex items-center flex-col gap-4 py-10 border-dashed">
          <div className="rounded-full bg-muted p-4">
            <ServerIcon className="size-6" />
          </div>
          <div className="text-center max-w-xs gap-2 flex flex-col items-center">
            <h3 className="text-lg font-semibold">No servers configured</h3>
            <p className="text-muted-foreground mb-4">
              Add your first Half-Life server to begin tracking player statistics and activities.
            </p>
            <Button variant="solid" size="default" colorScheme="green" asChild>
              <Link href="/admin/server/create">
                <PlusCircleIcon data-slot="icon" />
                <span>Create server</span>
              </Link>
            </Button>
          </div>
        </Card>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
