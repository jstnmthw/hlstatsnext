import { gql } from "@apollo/client"

export const GET_USERS_QUERY = gql`
  query GetUsers {
    findManyUser {
      username
      acclevel
      playerId
      player {
        lastName
        email
        lastEvent
      }
    }
  }
`

export const GET_USERS_WITH_PAGINATION = gql`
  query GetUsersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [UserOrderByWithRelationInput!]
    $where: UserWhereInput
  ) {
    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      username
      acclevel
      playerId
      player {
        lastName
        email
        lastEvent
      }
    }
  }
`

export const GET_USER_COUNT = gql`
  query GetUserCount($where: UserWhereInput) {
    countUser(where: $where)
  }
`
