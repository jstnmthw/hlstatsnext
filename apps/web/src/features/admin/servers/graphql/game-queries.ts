import { graphql } from "@/lib/gql"

export const GET_GAMES_FOR_SELECT = graphql(`
  query GetGamesForSelect {
    findManyGame {
      code
      name
    }
  }
`)
