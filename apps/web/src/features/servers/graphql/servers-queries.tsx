import { graphql } from "@/lib/gql"

export const GET_SERVER_BY_ID = graphql(`
  query GetServerById($serverId: Int!) {
    findUniqueServer(where: { serverId: $serverId }) {
      serverId
      name
      address
      port
      game
      publicAddress
      statusUrl
      rconPassword
      connectionType
      dockerHost
      sortOrder
    }
  }
`)
