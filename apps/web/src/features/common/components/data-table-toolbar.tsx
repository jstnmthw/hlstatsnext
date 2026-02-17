"use client"

import { DataTableFacetedFilter } from "@/features/common/components/data-table-faceted-filter"
import { DataTableViewOptions } from "@/features/common/components/data-table-view-options"
import { DataTableConfig } from "@/features/common/types/data-table"
import { Button, IconX, Input } from "@repo/ui"
import { Table } from "@tanstack/react-table"
import { useEffect, useRef, useState } from "react"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  config: DataTableConfig
  search: string
  filters: Record<string, string[]>
  isFiltered: boolean
  onSearch: (value: string) => void
  onFilterChange: (filterId: string, values: string[]) => void
  onReset: () => void
  isPending: boolean
}

export function DataTableToolbar<TData>({
  table,
  config,
  search,
  filters,
  isFiltered,
  onSearch,
  onFilterChange,
  onReset,
  isPending,
}: DataTableToolbarProps<TData>) {
  const [searchInput, setSearchInput] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync external search state changes (e.g. reset)
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // Debounced search
  useEffect(() => {
    // Don't fire on initial mount or when values are in sync
    if (searchInput === search) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      onSearch(searchInput)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchInput, search, onSearch])

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder={config.filterPlaceholder || "Search..."}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
          disabled={isPending}
        />
        {config.filters?.map((filter) => (
          <DataTableFacetedFilter
            key={filter.id}
            title={filter.title}
            options={filter.options}
            selectedValues={filters[filter.id] || []}
            onSelectionChange={(values) => onFilterChange(filter.id, values)}
          />
        ))}
        {isFiltered && (
          <Button variant="ghost" onClick={onReset} className="h-8 px-2 lg:px-3">
            Reset
            <IconX className="ml-2 size-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
