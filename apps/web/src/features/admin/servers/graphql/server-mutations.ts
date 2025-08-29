import { graphql } from "@/lib/gql"

export const CREATE_SERVER_MUTATION = graphql(`
  mutation CreateServer($data: ServerCreateInput!) {
    createOneServer(data: $data) {
      serverId
      name
      address
      port
      game
    }
  }
`)

export const UPDATE_SERVER_MUTATION = graphql(`
  mutation UpdateServer($where: ServerWhereUniqueInput!, $data: ServerUpdateInput!) {
    updateOneServer(where: $where, data: $data) {
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
