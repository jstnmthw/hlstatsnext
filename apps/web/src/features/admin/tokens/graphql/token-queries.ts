import { graphql } from "@/lib/gql"

export const GET_SERVER_TOKENS = graphql(`
  query GetServerTokens($includeRevoked: Boolean, $take: Int, $skip: Int) {
    findManyServerToken(includeRevoked: $includeRevoked, take: $take, skip: $skip) {
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
`)

export const GET_SERVER_TOKEN_COUNT = graphql(`
  query GetServerTokenCount($includeRevoked: Boolean) {
    countServerToken(includeRevoked: $includeRevoked)
  }
`)

export const GET_SERVER_TOKEN_BY_ID = graphql(`
  query GetServerTokenById($id: Int!) {
    findServerToken(id: $id) {
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
`)
