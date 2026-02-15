import { GET_SERVERS_QUERY } from "@/features/admin/servers/graphql/server-queries"
import {
  VerticalList,
  VerticalListHeader,
  VerticalListItem,
} from "@/features/common/components/vertical-list"
import { query } from "@/lib/apollo-client"
import { Button, IconPlayerPlay, cn } from "@repo/ui"
import Link from "next/link"

export async function ServerList({ className }: { className?: string }) {
  const { data } = await query({ query: GET_SERVERS_QUERY })

  return (
    <VerticalList className={cn("mb-10", className)}>
      <VerticalListHeader>Game Servers</VerticalListHeader>
      <ul>
        {data?.findManyServer?.map((server) => (
          <VerticalListItem key={server.serverId}>
            <div className="flex items-center justify-between">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <div
                    className={cn(
                      "mx-3 h-2 w-2 rounded-full",
                      getOnlineStatus(server.lastEvent) === "Online"
                        ? "bg-emerald-500"
                        : "bg-red-500/50",
                    )}
                  />
                  <div>
                    <h3 className="font-mono">
                      <Link
                        href={`/servers/${server.serverId}`}
                        className="transition-colors hover:text-blue-400 hover:underline"
                      >
                        {server.name}
                      </Link>
                    </h3>
                    <ul className="flex flex-row space-x-2 font-mono">
                      {server.activeMap && <li>{server.activeMap}</li>}
                      <li className="text-muted-foreground">
                        {server.activePlayers}/{server.maxPlayers}
                      </li>
                      <li className="text-muted-foreground">{`${server.address}:${server.port}`}</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-center px-3">
                  <Button variant="outline" className="cursor-pointer text-xs" size="icon-sm">
                    <a href={`steam://connect/${server.address}:${server.port}`}>
                      <IconPlayerPlay className="size-3" fill="currentColor" />
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
const getOnlineStatus = (lastEvent: Date | null) => {
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
