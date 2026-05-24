import { graphql } from "@/lib/gql"

export const GET_GENERAL_STATS = graphql(`
  query GetGeneralStats {
    countPlayer
    countClan
    countGame
    countServer
    getTotalKills
    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {
      eventTime
    }
    findUniqueOption(where: { keyname: "DeleteDays" }) {
      value
    }
  }
`)
