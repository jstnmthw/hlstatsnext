import { graphql } from "@/lib/gql"

export const GET_USERS_QUERY = graphql(`
  query GetUsers {
    findManyUser {
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

export const GET_USERS_WITH_PAGINATION = graphql(`
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

export const GET_USER_COUNT = graphql(`
  query GetUserCount($where: UserWhereInput) {
    countUser(where: $where)
  }
`)
