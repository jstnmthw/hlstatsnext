import { gql } from "@apollo/client"

export const GET_GAMES_QUERY = gql`
  query GetGames {
    findManyGame {
      code
      name
      hidden
      realgame
    }
  }
`

export const GET_GAMES_WITH_PAGINATION = gql`
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
`

export const GET_GAME_COUNT = gql`
  query GetGameCount($where: GameWhereInput) {
    countGame(where: $where)
  }
`
