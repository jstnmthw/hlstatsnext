import { describe, expect, it } from "vitest"
import type { PaginationParams } from "./pagination"
import {
  buildCountVariables,
  buildPaginationVariables,
  getConfigDefaults,
  parseUrlParams,
} from "./pagination"

const baseParams: PaginationParams = {
  page: 1,
  pageSize: 25,
  sortField: "name",
  sortOrder: "asc",
  search: "",
  filters: {},
}

describe("buildPaginationVariables", () => {
  it("builds basic pagination variables", () => {
    const result = buildPaginationVariables(baseParams)
    expect(result.take).toBe(25)
    expect(result.skip).toBe(0)
    expect(result.orderBy).toEqual([{ name: "asc" }])
    expect(result.where).toBeUndefined()
  })

  it("calculates correct skip for page > 1", () => {
    const result = buildPaginationVariables({ ...baseParams, page: 3, pageSize: 10 })
    expect(result.skip).toBe(20)
  })

  it("builds search where clause", () => {
    const result = buildPaginationVariables({ ...baseParams, search: "test" }, ["name", "address"])
    expect(result.where).toBeDefined()
    expect(result.where!.OR).toEqual([
      { name: { contains: "test" } },
      { address: { contains: "test" } },
    ])
  })

  it("handles nested sort fields", () => {
    const result = buildPaginationVariables({
      ...baseParams,
      sortField: "player.lastName",
    })
    expect(result.orderBy).toEqual([{ player: { lastName: "asc" } }])
  })

  it("builds filter AND clauses with default transform", () => {
    const result = buildPaginationVariables({
      ...baseParams,
      filters: { game: ["css", "tf"] },
    })
    expect(result.where).toBeDefined()
    expect(result.where!.AND).toEqual([{ game: { in: ["css", "tf"] } }])
  })

  it("uses custom filter transforms", () => {
    const transforms = {
      status: (values: string[]) => ({ active: { in: values } }),
    }
    const result = buildPaginationVariables(
      { ...baseParams, filters: { status: ["active"] } },
      [],
      transforms,
    )
    expect(result.where!.AND).toEqual([{ active: { in: ["active"] } }])
  })

  it("skips empty filter arrays", () => {
    const result = buildPaginationVariables({
      ...baseParams,
      filters: { game: [] },
    })
    expect(result.where).toBeUndefined()
  })

  it("skips filters when transform returns undefined", () => {
    const transforms = {
      status: () => undefined,
    }
    const result = buildPaginationVariables(
      { ...baseParams, filters: { status: ["active"] } },
      [],
      transforms,
    )
    expect(result.where).toBeUndefined()
  })

  it("combines search and filters", () => {
    const result = buildPaginationVariables(
      { ...baseParams, search: "test", filters: { game: ["css"] } },
      ["name"],
    )
    expect(result.where!.OR).toBeDefined()
    expect(result.where!.AND).toBeDefined()
  })
})

describe("buildCountVariables", () => {
  it("returns empty object when no filters or search", () => {
    const result = buildCountVariables(baseParams)
    expect(result).toEqual({})
  })

  it("returns where clause when search is present", () => {
    const result = buildCountVariables({ ...baseParams, search: "test" }, ["name"])
    expect(result.where).toBeDefined()
    expect(result.where!.OR).toBeDefined()
  })

  it("returns where clause when filters are present", () => {
    const result = buildCountVariables({
      ...baseParams,
      filters: { game: ["css"] },
    })
    expect(result.where).toBeDefined()
    expect(result.where!.AND).toBeDefined()
  })
})

describe("parseUrlParams", () => {
  const defaults = {
    sortField: "name",
    sortOrder: "asc" as const,
    pageSize: 25,
  }

  it("parses URL params with defaults", () => {
    const result = parseUrlParams({}, defaults)
    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      sortField: "name",
      sortOrder: "asc",
      search: "",
      filters: {},
    })
  })

  it("parses provided URL params", () => {
    const result = parseUrlParams(
      {
        page: "3",
        pageSize: "10",
        sortField: "kills",
        sortOrder: "desc",
        search: "player",
      },
      defaults,
    )
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(10)
    expect(result.sortField).toBe("kills")
    expect(result.sortOrder).toBe("desc")
    expect(result.search).toBe("player")
  })

  it("parses filter definitions from URL", () => {
    const filterDefs = [
      { id: "game", title: "Game", options: [] },
      { id: "status", title: "Status", options: [], paramName: "st" },
    ]

    const result = parseUrlParams({ game: "css,tf", st: "active,banned" }, defaults, filterDefs)

    expect(result.filters.game).toEqual(["css", "tf"])
    expect(result.filters.status).toEqual(["active", "banned"])
  })

  it("handles missing filter params", () => {
    const filterDefs = [{ id: "game", title: "Game", options: [] }]
    const result = parseUrlParams({}, defaults, filterDefs)
    expect(result.filters).toEqual({})
  })
})

describe("getConfigDefaults", () => {
  it("extracts defaults from DataTableConfig", () => {
    const config = {
      defaultSortField: "name",
      defaultSortOrder: "desc" as const,
      defaultPageSize: 50,
    }
    expect(getConfigDefaults(config)).toEqual({
      sortField: "name",
      sortOrder: "desc",
      pageSize: 50,
    })
  })
})
