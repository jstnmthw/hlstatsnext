"use client"

import { useState } from "react"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui"

import { DataTableProvider } from "@/features/common/components/data-table-context"
import { DataTablePagination } from "@/features/common/components/data-table-pagination"
import { DataTableToolbar } from "@/features/common/components/data-table-toolbar"
import { useDataTableUrl } from "@/features/common/hooks/use-data-table-url"
import { DataTableConfig } from "@/features/common/types/data-table"

export type DataTableBorderStyle = "default" | "borderless" | "border-bottom" | "border-top"

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  totalCount: number
  config: DataTableConfig
  showToolbar?: boolean
  showPagination?: boolean
  borderStyle?: DataTableBorderStyle
}

const borderStyleClasses: Record<DataTableBorderStyle, string> = {
  default: "overflow-hidden rounded-md border border-border",
  borderless: [
    "[&_[data-slot=table-row]]:border-0",
    "[&_[data-slot=table-header]_tr]:border-0",
  ].join(" "),
  "border-bottom": ["[&_[data-slot=table-header]_tr]:border-0"].join(" "),
  "border-top": [
    "[&_[data-slot=table-header]_tr]:border-0",
    "[&_[data-slot=table-row]]:border-t",
    "[&_[data-slot=table-row]]:border-b-0",
    "[&_[data-slot=table-body]_tr:first-child]:border-0",
  ].join(" "),
}

export function DataTable<T>({
  data,
  columns,
  totalCount,
  config,
  showToolbar = true,
  showPagination = true,
  borderStyle = "default",
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const {
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
  } = useDataTableUrl(config)

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
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: currentState.page - 1,
        pageSize: currentState.pageSize,
      },
    },
    pageCount: Math.ceil(totalCount / currentState.pageSize),
  })

  return (
    <DataTableProvider
      value={{
        sortField: currentState.sortField,
        sortOrder: currentState.sortOrder,
        onSort: handleSort,
        onRefresh: handleRefresh,
        isPending,
      }}
    >
      <div className="flex flex-col gap-4">
        {showToolbar && (
          <DataTableToolbar
            table={table}
            config={config}
            search={currentState.search}
            filters={currentState.filters}
            isFiltered={isFiltered}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onReset={resetFilters}
            isPending={isPending}
          />
        )}

        <div className={borderStyleClasses[borderStyle]}>
          <div className={`${isPending ? "opacity-75" : ""} transition-opacity duration-200`}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
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
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center font-medium tracking-tight text-muted-foreground/60"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {showPagination && (
          <DataTablePagination
            totalCount={totalCount}
            currentPage={currentState.page}
            pageSize={currentState.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isPending={isPending}
          />
        )}
      </div>
    </DataTableProvider>
  )
}
