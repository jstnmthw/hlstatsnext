import { graphql } from "@/lib/gql"

/** Public server listing — only exposes leaderboard fields, no credentials. */
export const GET_PUBLIC_SERVERS_WITH_PAGINATION = graphql(`
  query GetPublicServersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [ServerOrderByWithRelationInput!]
    $where: ServerWhereInput
  ) {
    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      serverId
      name
      address
      port
      game
      activePlayers
      maxPlayers
      activeMap
      lastEvent
      city
      country
    }
  }
`)

export const GET_PUBLIC_SERVER_COUNT = graphql(`
  query GetPublicServerCount($where: ServerWhereInput) {
    countServer(where: $where)
  }
`)
