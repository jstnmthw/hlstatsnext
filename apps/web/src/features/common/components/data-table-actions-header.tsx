"use client"

import { useDataTableContext } from "@/features/common/components/data-table-context"
import { Button, cn, IconRefresh } from "@repo/ui"

export function DataTableActionsHeader() {
  const { onRefresh, isPending } = useDataTableContext()
  return (
    <div className="flex items-center justify-end pr-3 pl-1">
      <Button variant="ghost" className="group size-8 p-0" onClick={onRefresh} disabled={isPending}>
        <IconRefresh
          className={cn(
            "size-4",
            isPending ? "animate-spin" : "",
            "text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100",
          )}
        />
      </Button>
    </div>
  )
}
