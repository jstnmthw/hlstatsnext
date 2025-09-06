import { graphql } from "@/lib/gql"

export const GET_MODS_FOR_SELECT = graphql(`
  query GetModsForSelect {
    findManyModSupported {
      code
      name
    }
  }
`)
