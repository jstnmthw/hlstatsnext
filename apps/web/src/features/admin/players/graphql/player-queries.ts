import { graphql } from "@/lib/gql"

export const GET_PLAYERS_QUERY = graphql(`
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
`)

export const GET_PLAYERS_WITH_PAGINATION = graphql(`
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
      country
      flag
      lastEvent
      lastSkillChange
    }
  }
`)

export const GET_PLAYER_COUNT = graphql(`
  query GetPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`)
