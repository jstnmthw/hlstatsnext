import { graphql } from "@/lib/gql"

export const CREATE_SERVER_MUTATION = graphql(`
  mutation CreateServer($data: ServerCreateInput!) {
    createOneServer(data: $data) {
      id
      name
      address
      port
      game
    }
  }
`)