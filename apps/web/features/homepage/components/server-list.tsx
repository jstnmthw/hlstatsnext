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
  query GetServersWithStatus {
    serversStatus {
      id
      address
      port
      name
      isOnline
      lastActivity
      playerCount
    }
  }
`)

export async function ServerList({ className }: { className?: string }) {
  const { data } = await query({ query: GET_SERVERS_QUERY })

  return (
    <VerticalList className={cn("mb-10", className)}>
      <VerticalListHeader>Game Servers</VerticalListHeader>
      <ul>
        {data.serversStatus?.map((server) => (
          <VerticalListItem key={server.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mx-3",
                      server.isOnline ? "bg-emerald-500" : "bg-red-500/50",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">
                      {server.name || `${server.address}:${server.port}`}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {server.isOnline
                        ? `${server.playerCount} player${server.playerCount !== 1 ? "s" : ""} online`
                        : "Offline"}
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
