"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"

import { cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui"

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
  const { frozenColumnsLeft, frozenColumnsRight } = config
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const tableRef = useRef<HTMLDivElement>(null)
  const [frozenStyles, setFrozenStyles] = useState<Record<string, React.CSSProperties>>({})

  const frozenSet = useMemo(() => {
    const set = new Set<string>()
    frozenColumnsLeft?.forEach((id) => set.add(id))
    frozenColumnsRight?.forEach((id) => set.add(id))
    return set
  }, [frozenColumnsLeft, frozenColumnsRight])

  const hasFrozen = frozenSet.size > 0

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

  useLayoutEffect(() => {
    if (!hasFrozen || !tableRef.current) return

    const headerRow = tableRef.current.querySelector("[data-slot='table-header'] tr")
    if (!headerRow) return

    const headerCells = Array.from(headerRow.children) as HTMLElement[]
    const visibleColumns = table.getVisibleLeafColumns()

    const widthMap = new Map<string, number>()
    visibleColumns.forEach((col, i) => {
      const cell = headerCells[i]
      if (cell) widthMap.set(col.id, cell.offsetWidth)
    })

    const styles: Record<string, React.CSSProperties> = {}

    let leftAccum = 0
    for (const colId of frozenColumnsLeft || []) {
      if (!widthMap.has(colId)) continue
      styles[colId] = { position: "sticky", left: leftAccum, zIndex: 2 }
      leftAccum += widthMap.get(colId)!
    }

    let rightAccum = 0
    for (const colId of [...(frozenColumnsRight || [])].reverse()) {
      if (!widthMap.has(colId)) continue
      styles[colId] = { position: "sticky", right: rightAccum, zIndex: 2 }
      rightAccum += widthMap.get(colId)!
    }

    setFrozenStyles(styles)
  }, [hasFrozen, data, columnVisibility, frozenColumnsLeft, frozenColumnsRight, table])

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

        <div ref={tableRef} className={borderStyleClasses[borderStyle]}>
          <div className={`${isPending ? "opacity-75" : ""} transition-opacity duration-200`}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(frozenSet.has(header.column.id) && "bg-background")}
                        style={frozenStyles[header.column.id]}
                      >
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
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={hasFrozen ? "group/row" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            frozenSet.has(cell.column.id) &&
                              "bg-background group-hover/row:bg-muted/50 group-data-[state=selected]/row:bg-muted",
                          )}
                          style={frozenStyles[cell.column.id]}
                        >
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
