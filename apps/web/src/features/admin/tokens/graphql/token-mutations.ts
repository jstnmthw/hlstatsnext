import { graphql } from "@/lib/gql"

export const CREATE_SERVER_TOKEN = graphql(`
  mutation CreateServerToken($input: CreateServerTokenInput!) {
    createServerToken(input: $input) {
      success
      message
      rawToken
      token {
        id
        tokenPrefix
        name
        game
        createdAt
        expiresAt
        revokedAt
        lastUsedAt
        createdBy
        serverCount
        status
        hasRconPassword
      }
    }
  }
`)

export const REVOKE_SERVER_TOKEN = graphql(`
  mutation RevokeServerToken($input: RevokeServerTokenInput!) {
    revokeServerToken(input: $input) {
      success
      message
      token {
        id
        tokenPrefix
        name
        game
        createdAt
        expiresAt
        revokedAt
        lastUsedAt
        createdBy
        serverCount
        status
        hasRconPassword
      }
    }
  }
`)
