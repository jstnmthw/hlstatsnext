import "server-only"

import {
  buildCountVariables,
  buildPaginationVariables,
  type PaginationParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import type { PlayerListItem } from "@/lib/players"
import { requireAdmin } from "@repo/auth/session"

const adminPlayersWithPagination = graphql(`
  query GetAdminPlayersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [PlayerOrderByWithRelationInput!]
    $where: PlayerWhereInput
  ) {
    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      playerId
      lastName
      email
      skill
      kills
      deaths
      country
      flag
      lastEvent
      lastSkillChange
    }
  }
`)

const adminPlayerCount = graphql(`
  query GetAdminPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`)

const searchFields = ["lastName", "email"]

export interface PlayerPage {
  players: PlayerListItem[]
  totalCount: number
}

export async function listPlayers(params: PaginationParams): Promise<PlayerPage> {
  await requireAdmin()

  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: adminPlayersWithPagination,
      variables: buildPaginationVariables(params, searchFields),
    }),
    query({ query: adminPlayerCount, variables: buildCountVariables(params, searchFields) }),
  ])

  return { players: data?.findManyPlayer ?? [], totalCount: countData?.countPlayer ?? 0 }
}
