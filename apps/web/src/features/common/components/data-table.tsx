"use client"

import { useState, useMemo } from "react"

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

import { FilterConfig, DataTableOptions } from "@/features/common/types/data-table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterConfig?: FilterConfig
  options: DataTableOptions
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterConfig,
  options,
}: DataTableProps<TData, TValue>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [searchValue, setSearchValue] = useState(options.search || "")

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: {
      sorting: [],
      columnFilters: [],
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: (options.currentPage || 1) - 1,
        pageSize: options.pageSize || 10,
      },
    },
    pageCount: Math.ceil((options.totalCount || 0) / (options.pageSize || 10)),
  })

  const paginationInfo = useMemo(() => {
    const startItem = options.totalCount > 0 ? (options.currentPage - 1) * options.pageSize + 1 : 0
    const endItem = Math.min(options.currentPage * options.pageSize, options.totalCount)
    const canPreviousPage = options.currentPage > 1
    const canNextPage = options.currentPage < Math.ceil(options.totalCount / options.pageSize)

    return { startItem, endItem, totalCount: options.totalCount, canPreviousPage, canNextPage }
  }, [options])

  const handleSearchSubmit = () => {
    options.onSearch(searchValue)
  }

  return (
    <>
      <div className="flex items-center py-4">
        {filterConfig && (
          <div className="flex gap-2">
            <Input
              placeholder={filterConfig.placeholder}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearchSubmit()
                }
              }}
              className="max-w-sm dark:bg-zinc-950"
              disabled={options.isPending}
            />
            <Button
              variant="outline"
              colorScheme="dark"
              onClick={handleSearchSubmit}
              disabled={options.isPending}
            >
              <SearchIcon className="size-4" data-slot="icon" />
            </Button>
          </div>
        )}
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
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className={`${options.isPending ? "opacity-75" : ""} transition-opacity duration-200`}>
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
                              sortField: options.sortField,
                              sortOrder: options.sortOrder,
                              onSort: options.onSort,
                              onRefresh: options.onRefresh,
                              isPending: options.isPending,
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {paginationInfo.startItem} to {paginationInfo.endItem} of{" "}
          {paginationInfo.totalCount} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => options.onPageChange(options.currentPage - 1)}
            disabled={!paginationInfo.canPreviousPage || options.isPending}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => options.onPageChange(options.currentPage + 1)}
            disabled={!paginationInfo.canNextPage || options.isPending}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}
