import "server-only"

import type { PaginationParams } from "@/features/common/graphql/pagination"
import { getClient, query } from "@/lib/apollo-client"
import type { MutationOutcome } from "@/lib/data/outcome"
import { graphql } from "@/lib/gql"
import type { NewServerToken, TokenListItem } from "@/lib/tokens"
import { requireAdmin } from "@repo/auth/session"

const serverTokens = graphql(`
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

const serverTokenCount = graphql(`
  query GetServerTokenCount($includeRevoked: Boolean) {
    countServerToken(includeRevoked: $includeRevoked)
  }
`)

const createServerTokenMutation = graphql(`
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

const revokeServerTokenMutation = graphql(`
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

export interface TokenPage {
  tokens: TokenListItem[]
  totalCount: number
}

export async function listTokens(params: PaginationParams): Promise<TokenPage> {
  await requireAdmin()

  const includeRevoked = params.filters.status?.includes("revoked") ?? false
  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: serverTokens,
      variables: {
        includeRevoked,
        take: params.pageSize,
        skip: (params.page - 1) * params.pageSize,
      },
    }),
    query({ query: serverTokenCount, variables: { includeRevoked } }),
  ])

  return {
    tokens: (data?.findManyServerToken ?? []) as TokenListItem[],
    totalCount: countData?.countServerToken ?? 0,
  }
}

export interface TokenCreation extends MutationOutcome {
  rawToken: string | null
}

export async function createServerToken(input: NewServerToken): Promise<TokenCreation> {
  await requireAdmin()

  const result = await getClient().mutate({
    mutation: createServerTokenMutation,
    variables: {
      input: {
        name: input.name,
        game: input.game,
        rconPassword: input.rconPassword || undefined,
        expiresAt: input.expiresAt || undefined,
      },
    },
  })
  const payload = result.data?.createServerToken
  return {
    ok: Boolean(payload?.success),
    message: payload?.message ?? null,
    rawToken: payload?.rawToken ?? null,
  }
}

export async function revokeServerToken(id: number): Promise<MutationOutcome> {
  await requireAdmin()

  const result = await getClient().mutate({
    mutation: revokeServerTokenMutation,
    variables: { input: { id } },
  })
  const payload = result.data?.revokeServerToken
  return { ok: Boolean(payload?.success), message: payload?.message ?? null }
}
