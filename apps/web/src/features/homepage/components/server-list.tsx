import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"
import { Button, PlayIcon, cn } from "@repo/ui"
import {
  VerticalList,
  VerticalListHeader,
  VerticalListItem,
} from "@/features/common/components/vertical-list"

const GET_SERVERS_QUERY = graphql(`
  query GetServersWithStatus {
    findManyServer {
      serverId
      name
      address
      port
      activePlayers
      maxPlayers
      activeMap
      lastEvent
    }
  }
`)

export async function ServerList({ className }: { className?: string }) {
  const { data } = await query({ query: GET_SERVERS_QUERY })

  return (
    <VerticalList className={cn("mb-10", className)}>
      <VerticalListHeader>Game Servers</VerticalListHeader>
      <ul>
        {data.findManyServer?.map((server) => (
          <VerticalListItem key={server.serverId}>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mx-3",
                      getOnlineStatus(server.lastEvent) === "Online"
                        ? "bg-emerald-500"
                        : "bg-red-500/50",
                    )}
                  />
                  <div>
                    <h3 className="text-sm font-mono">{server.name}</h3>
                    <ul className="flex flex-row text-sm font-mono space-x-2">
                      {server.activeMap && <li>{server.activeMap}</li>}
                      <li className="text-muted-foreground">
                        {server.activePlayers}/{server.maxPlayers}
                      </li>
                      <li className="text-muted-foreground">{`${server.address}:${server.port}`}</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-center px-3">
                  <Button variant="outline" className="text-xs cursor-pointer" size="icon-sm">
                    <a href={`steam://connect/${server.address}:${server.port}`}>
                      <PlayIcon className="size-3" fill="currentColor" />
                    </a>
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

/**
 * Get the online status of a server based on the last event time.
 * @param lastEvent - The last event time of the server.
 * @returns "Online" if the server is online, "Offline" if the server is offline.
 */
const getOnlineStatus = (lastEvent: string | null) => {
  if (lastEvent === null) {
    return "Offline"
  }
  const lastEventDate = new Date(lastEvent)
  const now = new Date()
  const timeDiff = now.getTime() - lastEventDate.getTime()
  const minutesDiff = Math.floor(timeDiff / (1000 * 60))
  if (minutesDiff > 5) {
    return "Offline"
  }
  return "Online"
}
