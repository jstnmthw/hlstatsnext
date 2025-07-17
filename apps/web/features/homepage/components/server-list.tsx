import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import { Button } from "@repo/ui/button"
import { PlayIcon } from "@repo/ui/icons"
import { cn } from "@repo/ui/lib/utils"
import {
  VerticalList,
  VerticalListHeader,
  VerticalListItem,
} from "@/features/common/components/vertical-list"

const GET_SERVERS_QUERY = graphql(`
  query GetServersList {
    findManyServer(where: { act_players: { gte: 0 } }, orderBy: { act_players: desc }, take: 10) {
      serverId
      name
      address
      port
      act_players
      max_players
      act_map
      game
      city
      country
    }
  }
`)

export async function ServerList() {
  const { data } = await query({ query: GET_SERVERS_QUERY })

  return (
    <VerticalList>
      <VerticalListHeader>Active Game Servers</VerticalListHeader>
      <ul>
        {data.findManyServer.map((server) => (
          <VerticalListItem key={server.serverId}>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mx-3",
                      server.act_players > 0 ? "bg-emerald-500" : "bg-red-500/50",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{server.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {server.act_map || "Unknown"} {server.act_players}/{server.max_players}
                    </span>
                  </div>
                </div>
                <div className="flex items-center px-3">
                  <Button variant="outline" className="text-xs cursor-pointer" size="sm">
                    <PlayIcon className="size-3" fill="currentColor" />
                  </Button>
                </div>
              </div>
            </div>
          </VerticalListItem>
        ))}
      </ul>
    </VerticalList>
  )
}
