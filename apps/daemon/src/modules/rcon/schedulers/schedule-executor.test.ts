/**
 * Schedule Executor — fan-out regression tests
 *
 * Guards against the N² fan-out bug: the executor fans out a schedule across
 * every active server (one `execute()` call per server), and the command must
 * act only on the server handed to it. If a command re-discovers the full
 * server list internally, N servers produce N² operations (every server gets
 * monitored once per server), flooding the logs and hammering RCON.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { describe, expect, it } from "vitest"
import { mockDeep } from "vitest-mock-extended"
import { ServerMonitoringCommand } from "../commands/scheduled/server-monitoring.command"
import type { IRconService } from "../types/rcon.types"
import type { ScheduleConfig, ScheduledCommand } from "../types/schedule.types"
import { ConcurrencyLimiter } from "./concurrency-limiter"
import { ScheduleExecutor } from "./schedule-executor"
import { ServerFilterResolver } from "./server-filter-resolver"

describe("ScheduleExecutor fan-out (N, not N²)", () => {
  const config: ScheduleConfig = {
    enabled: true,
    defaultTimeoutMs: 5000,
    defaultRetryOnFailure: false,
    defaultMaxRetries: 0,
    historyRetentionHours: 24,
    maxConcurrentPerServer: 1,
    schedules: [],
  }

  const monitoringSchedule: ScheduledCommand = {
    id: "server-monitoring",
    name: "Server Status Monitoring",
    cronExpression: "*/30 * * * * *",
    command: { type: "server-monitoring" },
    enabled: true,
  }

  it("enriches each active server exactly once per tick", async () => {
    const logger = mockDeep<ILogger>()
    const rconService = mockDeep<IRconService>()
    const serverService = mockDeep<IServerService>()
    const enricher = mockDeep<IServerStatusEnricher>()
    const sessionService = mockDeep<IPlayerSessionService>()

    const servers: ServerInfo[] = [1, 2, 3].map((id) => ({
      serverId: id,
      game: "cstrike",
      name: `Server ${id}`,
      address: `127.0.0.${id}`,
      port: 27000 + id,
    }))

    serverService.findActiveServersWithRcon.mockResolvedValue(servers)
    rconService.isConnected.mockReturnValue(true)
    enricher.enrichServerStatus.mockResolvedValue()

    const monitoringCommand = new ServerMonitoringCommand(
      logger,
      rconService,
      serverService,
      enricher,
      sessionService,
    )

    const executor = new ScheduleExecutor(
      logger,
      serverService,
      config,
      new ServerFilterResolver(logger),
      new ConcurrencyLimiter(config.maxConcurrentPerServer),
      (type) => (type === "server-monitoring" ? monitoringCommand : undefined),
    )

    const results = await executor.executeForServers(monitoringSchedule)

    // The N² regression produced 9 enrichments (3 servers × 3 re-discoveries).
    // The fix yields exactly one enrichment per server.
    expect(enricher.enrichServerStatus).toHaveBeenCalledTimes(servers.length)
    expect(enricher.enrichServerStatus).toHaveBeenCalledWith(1)
    expect(enricher.enrichServerStatus).toHaveBeenCalledWith(2)
    expect(enricher.enrichServerStatus).toHaveBeenCalledWith(3)

    expect(results).toHaveLength(servers.length)
    expect(results.every((r) => r.status === "success")).toBe(true)
  })
})
