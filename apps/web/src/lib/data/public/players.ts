// Public: the leaderboard and the top-players widget. The query selects no
// personal data, so nothing here needs a session.
import "server-only"

import {
  buildCountVariables,
  buildPaginationVariables,
  type PaginationParams,
  type WhereFilter,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import { SortOrder } from "@/lib/gql/graphql"
import type { PublicPlayerItem } from "@/lib/players"

const publicPlayersWithPagination = graphql(`
  query GetPublicPlayersWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [PlayerOrderByWithRelationInput!]
    $where: PlayerWhereInput
  ) {
    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      playerId
      lastName
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

const publicPlayerCount = graphql(`
  query GetPublicPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`)

const searchFields = ["lastName"]

// Bots are still tracked and ranked when a server's IgnoreBots is off; the
// public views only hide them by default.
function withHumanFilter(
  where: WhereFilter | undefined,
  showBots: boolean,
): WhereFilter | undefined {
  if (showBots) return where
  return { ...(where ?? {}), isBot: { equals: false } }
}

export interface PublicPlayerPage {
  players: PublicPlayerItem[]
  totalCount: number
}

export async function listPublicPlayers(
  params: PaginationParams,
  options: { showBots: boolean },
): Promise<PublicPlayerPage> {
  const listVariables = buildPaginationVariables(params, searchFields)
  const countVariables = buildCountVariables(params, searchFields)

  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: publicPlayersWithPagination,
      variables: {
        ...listVariables,
        where: withHumanFilter(listVariables.where, options.showBots),
      },
    }),
    query({
      query: publicPlayerCount,
      variables: { where: withHumanFilter(countVariables.where, options.showBots) },
    }),
  ])

  return { players: data?.findManyPlayer ?? [], totalCount: countData?.countPlayer ?? 0 }
}

export async function topPlayers(limit: number): Promise<PublicPlayerItem[]> {
  const { data } = await query({
    query: publicPlayersWithPagination,
    variables: {
      take: limit,
      orderBy: [{ skill: SortOrder.Desc }],
      where: withHumanFilter(undefined, false),
    },
  })
  return data?.findManyPlayer ?? []
}
