"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

export interface DataTableConfig {
  defaultSortField: string
  defaultSortOrder: "asc" | "desc"
  defaultPageSize: number
}

export interface DataTableUrlState {
  page: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
  pageSize: number
}

export function useDataTableUrl(config: DataTableConfig) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const updateURL = useCallback(
    (params: Partial<DataTableUrlState>) => {
      const searchParams = new URLSearchParams()

      // Add non-default values to URL
      if (params.page && params.page !== 1) {
        searchParams.set("page", params.page.toString())
      }
      if (params.sortField && params.sortField !== config.defaultSortField) {
        searchParams.set("sortField", params.sortField)
      }
      if (params.sortOrder && params.sortOrder !== config.defaultSortOrder) {
        searchParams.set("sortOrder", params.sortOrder)
      }
      if (params.search) {
        searchParams.set("search", params.search)
      }
      if (params.pageSize && params.pageSize !== config.defaultPageSize) {
        searchParams.set("pageSize", params.pageSize.toString())
      }

      const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
      startTransition(() => {
        router.push(url)
      })
    },
    [router, pathname, config],
  )

  const handleSort = useCallback(
    (fieldWithDirection: string, currentState: DataTableUrlState) => {
      const [field, direction] = fieldWithDirection.includes(":")
        ? fieldWithDirection.split(":")
        : [
            fieldWithDirection,
            currentState.sortField === fieldWithDirection && currentState.sortOrder === "asc"
              ? "desc"
              : "asc",
          ]

      updateURL({
        sortField: field,
        sortOrder: direction as "asc" | "desc",
        search: currentState.search || undefined,
        pageSize:
          currentState.pageSize !== config.defaultPageSize ? currentState.pageSize : undefined,
        page: 1, // Reset to first page when sorting
      })
    },
    [updateURL, config.defaultPageSize],
  )

  const handlePageChange = useCallback(
    (page: number, currentState: DataTableUrlState) => {
      updateURL({
        page,
        sortField:
          currentState.sortField !== config.defaultSortField ? currentState.sortField : undefined,
        sortOrder:
          currentState.sortOrder !== config.defaultSortOrder ? currentState.sortOrder : undefined,
        search: currentState.search || undefined,
        pageSize:
          currentState.pageSize !== config.defaultPageSize ? currentState.pageSize : undefined,
      })
    },
    [updateURL, config],
  )

  const handleSearch = useCallback(
    (searchValue: string, currentState: DataTableUrlState) => {
      updateURL({
        search: searchValue || undefined,
        sortField:
          currentState.sortField !== config.defaultSortField ? currentState.sortField : undefined,
        sortOrder:
          currentState.sortOrder !== config.defaultSortOrder ? currentState.sortOrder : undefined,
        pageSize:
          currentState.pageSize !== config.defaultPageSize ? currentState.pageSize : undefined,
        page: 1, // Reset to first page when searching
      })
    },
    [updateURL, config],
  )

  const handlePageSizeChange = useCallback(
    (pageSize: number, currentState: DataTableUrlState) => {
      updateURL({
        pageSize: pageSize !== config.defaultPageSize ? pageSize : undefined,
        sortField:
          currentState.sortField !== config.defaultSortField ? currentState.sortField : undefined,
        sortOrder:
          currentState.sortOrder !== config.defaultSortOrder ? currentState.sortOrder : undefined,
        search: currentState.search || undefined,
        page: 1, // Reset to first page when changing page size
      })
    },
    [updateURL, config],
  )

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  return {
    handleSort,
    handlePageChange,
    handleSearch,
    handlePageSizeChange,
    handleRefresh,
    isPending,
  }
}
