import "server-only"

import { statusFilterTransform } from "@/features/admin/users/lib/user-filters"
import {
  buildCountVariables,
  buildPaginationVariables,
  type FilterTransform,
  type PaginationParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import type { UserListItem } from "@/lib/users"
import { requireAdmin } from "@repo/auth/session"

const usersWithPagination = graphql(`
  query GetUsersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [UserOrderByWithRelationInput!]
    $where: UserWhereInput
  ) {
    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      id
      name
      email
      emailVerified
      role
      banned
      banReason
      banExpires
      image
      createdAt
      updatedAt
    }
  }
`)

const userCount = graphql(`
  query GetUserCount($where: UserWhereInput) {
    countUser(where: $where)
  }
`)

const searchFields = ["name", "email"]

const filterTransforms: Record<string, FilterTransform> = {
  status: statusFilterTransform,
}

export interface UserPage {
  users: UserListItem[]
  totalCount: number
}

export async function listUsers(params: PaginationParams): Promise<UserPage> {
  await requireAdmin()

  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: usersWithPagination,
      variables: buildPaginationVariables(params, searchFields, filterTransforms),
    }),
    query({
      query: userCount,
      variables: buildCountVariables(params, searchFields, filterTransforms),
    }),
  ])

  return { users: data?.findManyUser ?? [], totalCount: countData?.countUser ?? 0 }
}
