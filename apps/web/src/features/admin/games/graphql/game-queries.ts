import { graphql } from "@/lib/gql"

export const GET_GAMES_QUERY = graphql(`
  query GetGames {
    findManyGame {
      code
      name
      hidden
      realgame
    }
  }
`)

export const GET_GAMES_WITH_PAGINATION = graphql(`
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

export const GET_GAME_COUNT = graphql(`
  query GetGameCount($where: GameWhereInput) {
    countGame(where: $where)
  }
`)
