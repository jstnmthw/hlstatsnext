import { graphql } from "@/lib/gql"

export const GET_SERVERS_QUERY = graphql(`
  query GetServers {
    findManyServer {
      serverId
      name
      address
      port
      activePlayers
      maxPlayers
      activeMap
      lastEvent
    }
  }
`)
