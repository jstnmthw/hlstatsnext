"use client"

import { DataTableConfig } from "@/features/common/types/data-table"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useTransition } from "react"

export interface DataTableUrlState {
  page: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
  pageSize: number
  filters: Record<string, string[]>
}

export function useDataTableUrl(config: DataTableConfig) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Parse current state from URL search params
  const currentState = useMemo((): DataTableUrlState => {
    const filters: Record<string, string[]> = {}
    if (config.filters) {
      for (const filter of config.filters) {
        const paramName = filter.paramName || filter.id
        const value = searchParams.get(paramName)
        if (value) {
          filters[filter.id] = value.split(",")
        }
      }
    }

    return {
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || config.defaultPageSize,
      sortField: searchParams.get("sortField") || config.defaultSortField,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || config.defaultSortOrder,
      search: searchParams.get("search") || "",
      filters,
    }
  }, [searchParams, config])

  const pushState = useCallback(
    (state: DataTableUrlState) => {
      const params = new URLSearchParams()

      if (state.page > 1) {
        params.set("page", state.page.toString())
      }
      if (state.sortField !== config.defaultSortField) {
        params.set("sortField", state.sortField)
      }
      if (state.sortOrder !== config.defaultSortOrder) {
        params.set("sortOrder", state.sortOrder)
      }
      if (state.search) {
        params.set("search", state.search)
      }
      if (state.pageSize !== config.defaultPageSize) {
        params.set("pageSize", state.pageSize.toString())
      }

      // Serialize filter values as comma-separated
      if (config.filters) {
        for (const filter of config.filters) {
          const values = state.filters[filter.id]
          if (values && values.length > 0) {
            const paramName = filter.paramName || filter.id
            params.set(paramName, values.join(","))
          }
        }
      }

      const url = params.toString() ? `${pathname}?${params}` : pathname
      startTransition(() => {
        router.push(url)
      })
    },
    [router, pathname, config],
  )

  const handleSort = useCallback(
    (fieldWithDirection: string) => {
      const [field, direction] = fieldWithDirection.includes(":")
        ? fieldWithDirection.split(":")
        : [
            fieldWithDirection,
            currentState.sortField === fieldWithDirection && currentState.sortOrder === "asc"
              ? "desc"
              : "asc",
          ]

      pushState({
        ...currentState,
        sortField: field!,
        sortOrder: direction as "asc" | "desc",
        page: 1,
      })
    },
    [pushState, currentState],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      pushState({ ...currentState, page })
    },
    [pushState, currentState],
  )

  const handleSearch = useCallback(
    (search: string) => {
      pushState({ ...currentState, search, page: 1 })
    },
    [pushState, currentState],
  )

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      pushState({ ...currentState, pageSize, page: 1 })
    },
    [pushState, currentState],
  )

  const handleFilterChange = useCallback(
    (filterId: string, values: string[]) => {
      pushState({
        ...currentState,
        filters: { ...currentState.filters, [filterId]: values },
        page: 1,
      })
    },
    [pushState, currentState],
  )

  const resetFilters = useCallback(() => {
    pushState({
      page: 1,
      sortField: config.defaultSortField,
      sortOrder: config.defaultSortOrder,
      search: "",
      pageSize: config.defaultPageSize,
      filters: {},
    })
  }, [pushState, config])

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const isFiltered = useMemo(() => {
    if (currentState.search) return true
    for (const values of Object.values(currentState.filters)) {
      if (values.length > 0) return true
    }
    return false
  }, [currentState])

  return {
    currentState,
    handleSort,
    handlePageChange,
    handleSearch,
    handlePageSizeChange,
    handleFilterChange,
    resetFilters,
    handleRefresh,
    isPending,
    isFiltered,
  }
}
