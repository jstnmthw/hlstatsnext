import { AdminHeader } from "@/features/admin/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  IconArrowUpRight,
  IconServer,
} from "@repo/ui"
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
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your game servers, view player statistics, and configure settings. different
              </p>
            </div>
          </div>
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconServer className="h-10 w-10" />
              </EmptyMedia>
              <EmptyTitle>Generate your first server token</EmptyTitle>
              <EmptyDescription>
                Get started by generating a token for your game server plugin.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button>
                <Link href="/admin/tokens/add">Add Token</Link>
              </Button>
              <Button variant="outline">
                <Link href="/admin/tokens">View Tokens</Link>
              </Button>
            </EmptyContent>
            <Button variant="ghost" asChild className="text-muted-foreground" size="sm">
              <a href="#">
                Learn More <IconArrowUpRight />
              </a>
            </Button>
          </Empty>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
