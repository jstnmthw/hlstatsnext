"use client"

import { Badge, Button } from "@repo/ui"
import { formatDate } from "@/lib/datetime-util"
import { useServerBasicInfo, useServerPlayerCounts } from "../hooks/use-server-players"
import { ExternalLink, RefreshCw, Copy } from "lucide-react"
import { useState } from "react"

interface ServerHeaderProps {
  serverId: number
  className?: string
}

export function ServerHeader({ serverId, className }: ServerHeaderProps) {
  const { server, loading, error, refetch } = useServerBasicInfo(serverId)
  const { totalCount, recentCount, loading: countsLoading } = useServerPlayerCounts(serverId)
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = async () => {
    if (server) {
      await navigator.clipboard.writeText(`${server.address}:${server.port}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  if (loading) {
    return (
      <div className={`animate-pulse rounded-lg border border-border bg-card p-6 ${className}`}>
        <div className="h-8 bg-gray-300 rounded mb-2"></div>
        <div className="h-4 bg-gray-300 rounded mb-4 w-2/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-300 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !server) {
    return (
      <div
        className={`rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950 ${className}`}
      >
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading server
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>Unable to load server information. Please try again.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Determine server status
  const isOnline =
    server.lastEvent && new Date(server.lastEvent).getTime() > Date.now() - 30 * 60 * 1000

  return (
    <div className={`rounded-lg border border-border bg-card p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{server.name || "Unnamed Server"}</h1>
            <Badge
              variant="outline"
              colorScheme={isOnline ? "green" : "light"}
              className={isOnline ? "text-green-400 border-green-600" : ""}
            >
              {isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge variant="outline" colorScheme="blue">
              {server.game.toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono">
                {server.address}:{server.port}
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopyAddress} className="h-6 w-6 p-0">
                <Copy className="h-3 w-3" />
              </Button>
              {copied && <span className="text-green-400 text-xs">Copied!</span>}
            </div>
            {server.publicAddress &&
              server.publicAddress !== `${server.address}:${server.port}` && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-3 w-3" />
                  <span>Public: {server.publicAddress}</span>
                </div>
              )}
          </div>

          {server.city && server.country && (
            <div className="text-sm text-muted-foreground mb-4">
              📍 {server.city}, {server.country}
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={handleRefresh} className="h-8 w-8 p-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Server Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">
            {server.activePlayers || 0}/{server.maxPlayers || 0}
          </div>
          <div className="text-xs text-muted-foreground">Players</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{server.activePlayers || 0}</div>
          <div className="text-xs text-muted-foreground">Online</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">
            {countsLoading ? "..." : totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">
            {countsLoading ? "..." : recentCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Recent</div>
        </div>
      </div>

      {/* Current Map & Last Activity */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {server.activeMap && (
            <div>
              <span className="text-muted-foreground">Current Map:</span>
              <span className="ml-2 font-medium">{server.activeMap}</span>
            </div>
          )}
          {server.lastEvent && (
            <div>
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="ml-2 font-medium">{formatDate(server.lastEvent)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
