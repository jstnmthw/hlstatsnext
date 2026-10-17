import "server-only"

import {
  buildCountVariables,
  buildPaginationVariables,
  type PaginationParams,
} from "@/features/common/graphql/pagination"
import { query } from "@/lib/apollo-client"
import type { GameListItem, GameOption } from "@/lib/games"
import { graphql } from "@/lib/gql"
import { requireAdmin } from "@repo/auth/session"

const gamesWithPagination = graphql(`
  query GetGamesWithPagination(
    $take: Int
    $skip: Int
    $orderBy: [GameOrderByWithRelationInput!]
    $where: GameWhereInput
  ) {
    findManyGame(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {
      code
      name
      hidden
      realgame
    }
  }
`)

const gameCount = graphql(`
  query GetGameCount($where: GameWhereInput) {
    countGame(where: $where)
  }
`)

const gamesForSelect = graphql(`
  query GetGamesForSelect {
    findManyGame {
      code
      name
    }
  }
`)

const searchFields = ["code", "name"]

export interface GamePage {
  games: GameListItem[]
  totalCount: number
}

export async function listGames(params: PaginationParams): Promise<GamePage> {
  await requireAdmin()

  const [{ data }, { data: countData }] = await Promise.all([
    query({
      query: gamesWithPagination,
      variables: buildPaginationVariables(params, searchFields),
    }),
    query({ query: gameCount, variables: buildCountVariables(params, searchFields) }),
  ])

  return { games: data?.findManyGame ?? [], totalCount: countData?.countGame ?? 0 }
}

export async function listGameOptions(): Promise<GameOption[]> {
  await requireAdmin()

  const { data } = await query({ query: gamesForSelect })
  return data?.findManyGame ?? []
}
