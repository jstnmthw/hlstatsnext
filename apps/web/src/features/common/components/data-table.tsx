"use client"

import { useState, useMemo, useCallback } from "react"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  Settings2Icon,
  SearchIcon,
} from "@repo/ui"

import { useDataTableUrl, DataTableConfig } from "@/features/common/hooks/use-data-table-url"

export interface DataTableProps<T> {
  // Data
  data: T[]
  columns: ColumnDef<T>[]

  // Server-side props (for server-rendered tables)
  totalCount?: number
  currentPage?: number
  pageSize?: number
  sortField?: string
  sortOrder?: "asc" | "desc"
  searchValue?: string

  // Configuration for server-side behavior
  serverConfig?: DataTableConfig

  // Features (all optional with sensible defaults)
  enablePagination?: boolean
  enableSorting?: boolean
  enableFiltering?: boolean
  enableColumnVisibility?: boolean
  enableRowSelection?: boolean
  enableActions?: boolean

  // UI Configuration
  filterPlaceholder?: string

  // Server-side callbacks (when provided, enables server mode)
  onPageChange?: (page: number) => void
  onSort?: (field: string, order: "asc" | "desc") => void
  onSearch?: (value: string) => void
  onRefresh?: () => void

  // UI state
  isLoading?: boolean
}

export function DataTable<T>({
  data,
  columns,
  totalCount = 0,
  currentPage = 1,
  pageSize = 10,
  sortField,
  sortOrder = "asc",
  searchValue = "",
  serverConfig,
  enablePagination = true,
  enableSorting = true,
  enableFiltering = true,
  enableColumnVisibility = true,
  enableRowSelection = true,
  enableActions = true,
  filterPlaceholder = "Search...",
  onPageChange,
  onSort,
  onSearch,
  onRefresh, // eslint-disable-line @typescript-eslint/no-unused-vars
  isLoading = false,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [searchInput, setSearchInput] = useState(searchValue)

  // Determine if we're in server mode
  const isServerMode = !!(onPageChange || onSort || onSearch)

  // Use URL hooks only in server mode
  const urlHooks = useDataTableUrl(
    serverConfig || {
      defaultSortField: sortField || "",
      defaultSortOrder: sortOrder,
      defaultPageSize: pageSize,
    },
  )

  const { handleSort, handlePageChange, handleSearch, handleRefresh, isPending } = isServerMode
    ? urlHooks
    : {
        handleSort: () => {},
        handlePageChange: () => {},
        handleSearch: () => {},
        handleRefresh: () => {},
        isPending: false,
      }

  // Filter out actions column if actions are disabled
  const filteredColumns = enableActions ? columns : columns.filter((col) => col.id !== "actions")

  const table = useReactTable({
    data,
    columns: filteredColumns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: enableColumnVisibility ? setColumnVisibility : undefined,
    onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
    manualPagination: isServerMode,
    manualSorting: isServerMode && enableSorting,
    manualFiltering: isServerMode && enableFiltering,
    state: {
      sorting: [],
      columnFilters: [],
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: pageSize,
      },
    },
    pageCount: isServerMode ? Math.ceil(totalCount / pageSize) : -1,
  })

  const paginationInfo = useMemo(() => {
    const totalItems = isServerMode ? totalCount : data.length
    const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0
    const endItem = Math.min(currentPage * pageSize, totalItems)
    const canPreviousPage = currentPage > 1
    const canNextPage = currentPage < Math.ceil(totalItems / pageSize)

    return { startItem, endItem, totalCount: totalItems, canPreviousPage, canNextPage }
  }, [currentPage, pageSize, totalCount, data.length, isServerMode])

  const handleSearchSubmit = useCallback(() => {
    if (isServerMode && serverConfig) {
      const currentState = {
        page: currentPage,
        pageSize,
        sortField: sortField || "",
        sortOrder,
        search: searchInput,
      }
      handleSearch(searchInput, currentState)
    }
  }, [
    isServerMode,
    serverConfig,
    searchInput,
    currentPage,
    pageSize,
    sortField,
    sortOrder,
    handleSearch,
  ])

  const handlePageChangeWrapper = useCallback(
    (page: number) => {
      if (isServerMode && serverConfig) {
        const currentState = {
          page: currentPage,
          pageSize,
          sortField: sortField || "",
          sortOrder,
          search: searchValue,
        }
        handlePageChange(page, currentState)
      }
    },
    [
      isServerMode,
      serverConfig,
      currentPage,
      pageSize,
      sortField,
      sortOrder,
      searchValue,
      handlePageChange,
    ],
  )

  const loading = isLoading || (isServerMode ? isPending : false)

  return (
    <>
      <div className="flex items-center py-4">
        {enableFiltering && (
          <div className="flex gap-2">
            <Input
              placeholder={filterPlaceholder}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearchSubmit()
                }
              }}
              className="max-w-sm dark:bg-zinc-950"
              disabled={loading}
            />
            <Button
              variant="outline"
              colorScheme="dark"
              onClick={handleSearchSubmit}
              disabled={loading}
            >
              <SearchIcon className="size-4" data-slot="icon" />
            </Button>
          </div>
        )}

        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" colorScheme="light" className="ml-auto">
                <Settings2Icon className="size-4" data-slot="icon" /> View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className={`${loading ? "opacity-75" : ""} transition-opacity duration-200`}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, {
                              ...header.getContext(),
                              sortField: sortField,
                              sortOrder: sortOrder,
                              onSort: isServerMode
                                ? (field: string) => {
                                    const currentState = {
                                      page: currentPage,
                                      pageSize,
                                      sortField: sortField || "",
                                      sortOrder,
                                      search: searchValue,
                                    }
                                    handleSort(field, currentState)
                                  }
                                : undefined,
                              onRefresh: isServerMode
                                ? () => {
                                    handleRefresh()
                                  }
                                : undefined,
                              isPending: loading,
                            })}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={filteredColumns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {enablePagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {paginationInfo.startItem} to {paginationInfo.endItem} of{" "}
            {paginationInfo.totalCount} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => handlePageChangeWrapper(currentPage - 1)}
              disabled={!paginationInfo.canPreviousPage || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePageChangeWrapper(currentPage + 1)}
              disabled={!paginationInfo.canNextPage || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
