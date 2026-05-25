"use client"

import { Checkbox } from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"

/**
 * Shared select-all/select-row checkbox column for admin data tables.
 * Every admin table uses the same shape; this avoids the 20-line
 * copy-paste that previously lived in each `*-columns.tsx`.
 */
export function createSelectColumn<T>(): ColumnDef<T> {
  return {
    id: "select",
    header: ({ table }) => (
      <div className="flex max-w-10 items-center justify-center pr-3 pl-1">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex max-w-10 items-center justify-center pr-3 pl-1">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }
}
