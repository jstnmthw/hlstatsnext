import { describe, expect, it } from "vitest"
import { StatisticsService } from "../../src/services/statistics/statistics.service"

describe("StatisticsService", () => {
  it("start() and stop() resolve without errors", async () => {
    const stats = new StatisticsService()

    await expect(stats.start()).resolves.toBeUndefined()
    await expect(stats.stop()).resolves.toBeUndefined()
  })

  it("getPlayerStats returns object", async () => {
    const stats = new StatisticsService()
    const result = await stats.getPlayerStats(1)
    expect(result).toBeTypeOf("object")
  })
})
