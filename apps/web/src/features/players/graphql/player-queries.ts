import { graphql } from "@/lib/gql"

/** Public player listing — must not select PII (no email, lastAddress, etc). */
export const GET_PUBLIC_PLAYERS_WITH_PAGINATION = graphql(`
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

export const GET_PUBLIC_PLAYER_COUNT = graphql(`
  query GetPublicPlayerCount($where: PlayerWhereInput) {
    countPlayer(where: $where)
  }
`)
