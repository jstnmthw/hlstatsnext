import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@repo/ui"
import { query } from "@/lib/apollo-client"
import { Footer } from "@/features/common/components/footer"
import { AdminHeader } from "@/features/admin/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { AdminUsersTable } from "@/features/admin/users/components/admin-users-table"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import {
  GET_USERS_WITH_PAGINATION,
  GET_USER_COUNT,
} from "@/features/admin/users/graphql/user-queries"
import {
  parseUrlParams,
  buildPaginationVariables,
  buildCountVariables,
} from "@/features/common/graphql/pagination"

export const metadata: Metadata = {
  title: "Manage Users - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your system users and their access levels.",
}

export default async function UsersPage(props: AdminPageProps) {
  const searchParams = await props.searchParams

  // Parse URL parameters using shared utility
  const params = parseUrlParams(searchParams, {
    sortField: "username",
    sortOrder: "asc",
    pageSize: 10,
  })

  // Build GraphQL variables using shared utility
  const queryVariables = buildPaginationVariables(params, ["username", "player.lastName"])
  const countVariables = buildCountVariables(params, ["username", "player.lastName"])

  // Fetch data on server
  const { data } = await query({
    query: GET_USERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_USER_COUNT,
    variables: countVariables,
  })

  const users = data.findManyUser || []
  const totalCount = countData.countUser || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/users" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Manage Users</h1>
              <p className="text-muted-foreground">
                Manage your system users and their access levels.
              </p>
            </div>
            <div>
              <Button variant="solid" colorScheme="green" size="sm">
                <Link href="/admin/users/add">Add User</Link>
              </Button>
            </div>
          </div>
          <AdminUsersTable
            data={users}
            totalCount={totalCount}
            currentPage={params.page}
            pageSize={params.pageSize}
            sortField={params.sortField}
            sortOrder={params.sortOrder}
            searchValue={params.search}
          />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
