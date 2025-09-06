import { graphql } from "@/lib/gql"

export const CREATE_SERVER_MUTATION = graphql(`
  mutation CreateServerWithConfig($data: CreateServerInput!) {
    createServerWithConfig(data: $data) {
      success
      message
      configsCount
      server {
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

export const UPDATE_SERVER_WITH_CONFIG_MUTATION = graphql(`
  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {
    updateServerWithConfig(serverId: $serverId, data: $data) {
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
