import { AdminHeader } from "@/features/admin/common/components/header"
import { AdminPageProps } from "@/features/admin/common/types/admin-page"
import { AdminUsersTable } from "@/features/admin/users/components/admin-users-table"
import { userTableConfig } from "@/features/admin/users/components/user-columns"
import {
  GET_USER_COUNT,
  GET_USERS_WITH_PAGINATION,
} from "@/features/admin/users/graphql/user-queries"
import { statusFilterTransform } from "@/features/admin/users/lib/user-filters"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import {
  buildCountVariables,
  buildPaginationVariables,
  FilterTransform,
  getConfigDefaults,
  parseUrlParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { Button, IconUser } from "@repo/ui"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Manage Users - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your system users and their access levels.",
}

const userFilterTransforms: Record<string, FilterTransform> = {
  status: statusFilterTransform,
}

export default async function UsersPage(props: AdminPageProps) {
  const searchParams = await props.searchParams
  const params = parseUrlParams(
    searchParams,
    getConfigDefaults(userTableConfig),
    userTableConfig.filters,
  )

  const queryVariables = buildPaginationVariables(
    params,
    userTableConfig.searchFields,
    userFilterTransforms,
  )
  const countVariables = buildCountVariables(
    params,
    userTableConfig.searchFields,
    userFilterTransforms,
  )

  const { data } = await query({
    query: GET_USERS_WITH_PAGINATION,
    variables: queryVariables,
  })

  const { data: countData } = await query({
    query: GET_USER_COUNT,
    variables: countVariables,
  })

  const users = data?.findManyUser || []
  const totalCount = countData?.countUser || 0

  return (
    <PageWrapper>
      <AdminHeader currentPath="/admin/users" />
      <MainContent>
        <div className="container">
          <div className="mt-8 mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight uppercase">Manage Users</h1>
              <p className="text-muted-foreground">
                Manage your system users and their access levels.
              </p>
            </div>
            <div>
              <Button
                variant="solid"
                size="default"
                colorScheme="green"
                asChild
                className="pl-2.5!"
              >
                <Link href="/admin/users/add">
                  <IconUser data-slot="icon" />
                  <span>Add user</span>
                </Link>
              </Button>
            </div>
          </div>
          <AdminUsersTable data={users} totalCount={totalCount} />
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
