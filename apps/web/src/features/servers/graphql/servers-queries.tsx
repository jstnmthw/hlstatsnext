import { gql } from "@apollo/client"

export const GET_SERVER_BY_ID = gql`
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
`
