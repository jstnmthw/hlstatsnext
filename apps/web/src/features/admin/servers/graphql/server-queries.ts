import { graphql } from "@/lib/gql"

export const GET_SERVERS_QUERY = graphql(`
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
`)

export const GET_SERVERS_WITH_PAGINATION = graphql(`
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
`)

export const GET_SERVER_COUNT = graphql(`
  query GetServerCount($where: ServerWhereInput) {
    countServer(where: $where)
  }
`)

export const GET_SERVER_BY_ID = graphql(`
  query GetServerByIdWithConfigs($serverId: Int!) {
    findUniqueServer(where: { serverId: $serverId }) {
      serverId
      name
      address
      port
      game
      publicAddress
      statusUrl
      rconPassword
      sortOrder
      configs {
        parameter
        value
      }
    }
  }
`)
