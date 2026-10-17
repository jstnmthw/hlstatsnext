import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminTokensTable } from "@/features/admin/tokens/components/admin-tokens-table"
import { tokenTableConfig } from "@/features/admin/tokens/components/token-config"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { getConfigDefaults, parseUrlParams } from "@/features/common/graphql/pagination"
import { listTokens } from "@/lib/data/tokens"
import { Button, IconKey } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Server Tokens - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage server authentication tokens for game server plugins.",
}

export default async function TokensPage(props: AdminPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(tokenTableConfig),
    tokenTableConfig.filters,
  )

  const { tokens, totalCount } = await listTokens(params)

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/tokens" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase">Server Tokens</h1>
              <p className="text-muted-foreground">
                Manage authentication tokens for game server plugins to connect to the daemon.
              </p>
            </div>
            <Button variant="solid" size="default" colorScheme="green" asChild className="pl-2.5!">
              <Link href="/admin/tokens/add">
                <IconKey data-slot="icon" />
                <span>Add Token</span>
              </Link>
            </Button>
          </div>
          <AdminTokensTable data={tokens} totalCount={totalCount} />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
