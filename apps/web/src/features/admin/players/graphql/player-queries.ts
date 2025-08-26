import { gql } from "@apollo/client"

export const GET_PLAYERS_QUERY = gql`
  query GetPlayers {
    findManyPlayer {
      playerId
      lastName
      email
      skill
      kills
      deaths
      lastEvent
      lastSkillChange
    }
  }
`

export const GET_PLAYERS_WITH_PAGINATION = gql`
  query GetPlayersWithPagination(
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
      lastEvent
      lastSkillChange
    }
  }
`

export const GET_PLAYER_COUNT = gql`
  query GetPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`
