"use client"

import { useCallback, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { PlayerListItem, playerColumns, playerFilterConfig } from "./player-columns"
import { DataTable } from "@/features/common/components/data-table"

interface PlayerDataTableProps {
  data: PlayerListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

export function PlayerDataTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: PlayerDataTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const updateURL = useCallback(
    (params: Record<string, string | undefined>) => {
      const searchParams = new URLSearchParams()

      // Add non-default values to URL
      if (params.page && params.page !== "1") {
        searchParams.set("page", params.page)
      }
      if (params.sortField && params.sortField !== "lastName") {
        searchParams.set("sortField", params.sortField)
      }
      if (params.sortOrder && params.sortOrder !== "asc") {
        searchParams.set("sortOrder", params.sortOrder)
      }
      if (params.search) {
        searchParams.set("search", params.search)
      }

      const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
      startTransition(() => {
        router.push(url)
      })
    },
    [router, pathname],
  )

  const handleSort = useCallback(
    (fieldWithDirection: string) => {
      const [field, direction] = fieldWithDirection.includes(":")
        ? fieldWithDirection.split(":")
        : [
            fieldWithDirection,
            sortField === fieldWithDirection && sortOrder === "asc" ? "desc" : "asc",
          ]

      updateURL({
        sortField: field,
        sortOrder: direction as "asc" | "desc",
        search: search || undefined,
      })
    },
    [sortField, sortOrder, search, updateURL],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      updateURL({
        page: page.toString(),
        sortField: sortField !== "lastName" ? sortField : undefined,
        sortOrder: sortOrder !== "asc" ? sortOrder : undefined,
        search: search || undefined,
      })
    },
    [sortField, sortOrder, search, updateURL],
  )

  const handleSearch = useCallback(
    (searchValue: string) => {
      updateURL({
        search: searchValue || undefined,
        sortField: sortField !== "lastName" ? sortField : undefined,
        sortOrder: sortOrder !== "asc" ? sortOrder : undefined,
      })
    },
    [sortField, sortOrder, updateURL],
  )

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const columns = playerColumns({
    sortField,
    sortOrder,
    onSort: handleSort,
    onRefresh: handleRefresh,
    isPending,
  })

  return (
    <DataTable
      columns={columns}
      data={data}
      filterConfig={playerFilterConfig}
      options={{
        totalCount,
        currentPage,
        pageSize,
        sortField,
        sortOrder,
        search,
        onPageChange: handlePageChange,
        onSort: handleSort,
        onSearch: handleSearch,
        onRefresh: handleRefresh,
        isPending,
      }}
    />
  )
}
