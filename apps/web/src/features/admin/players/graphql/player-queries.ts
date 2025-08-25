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
