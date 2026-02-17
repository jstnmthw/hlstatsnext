import { describe, expect, it } from "vitest"
import { recentServerTableConfig, serverPageTableConfig } from "./server-config"

describe("recentServerTableConfig", () => {
  it("has correct defaults", () => {
    expect(recentServerTableConfig.defaultSortField).toBe("activePlayers")
    expect(recentServerTableConfig.defaultSortOrder).toBe("desc")
    expect(recentServerTableConfig.defaultPageSize).toBe(50)
  })
})

describe("serverPageTableConfig", () => {
  it("has correct defaults", () => {
    expect(serverPageTableConfig.defaultSortField).toBe("activePlayers")
    expect(serverPageTableConfig.defaultSortOrder).toBe("desc")
    expect(serverPageTableConfig.defaultPageSize).toBe(25)
  })

  it("has search configuration", () => {
    expect(serverPageTableConfig.searchFields).toEqual(["name", "address", "game"])
    expect(serverPageTableConfig.filterPlaceholder).toBe("Search servers...")
  })
})
