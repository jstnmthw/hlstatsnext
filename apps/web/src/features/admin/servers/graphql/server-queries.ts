import { gql } from "@apollo/client"

export const GET_SERVERS_QUERY = gql`
  query GetServers {
    findManyServer {
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
`

export const GET_SERVERS_WITH_PAGINATION = gql`
  query GetServersWithPagination(
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
`

export const GET_SERVER_COUNT = gql`
  query GetServerCount($where: ServerWhereInput) {
    countServer(where: $where)
  }
`
