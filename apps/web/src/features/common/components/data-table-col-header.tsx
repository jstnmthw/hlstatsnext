"use client"

import { useDataTableContext } from "@/features/common/components/data-table-context"
import { Button, cn, IconArrowDown, IconArrowUp, IconSelector } from "@repo/ui"

interface DataTableColumnHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  field: string
}

export function DataTableColumnHeader({ title, field, className }: DataTableColumnHeaderProps) {
  const { sortField, sortOrder, onSort } = useDataTableContext()
  const isCurrentSort = sortField === field

  const handleClick = () => {
    if (!isCurrentSort) {
      onSort(`${field}:asc`)
    } else if (sortOrder === "asc") {
      onSort(`${field}:desc`)
    } else {
      onSort(`${field}:asc`)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("group -ml-3 h-8", className)}
      onClick={handleClick}
    >
      <span className="text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100">
        {title}
      </span>
      {isCurrentSort && sortOrder === "desc" ? (
        <IconArrowDown className="size-4 text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100" />
      ) : isCurrentSort && sortOrder === "asc" ? (
        <IconArrowUp className="size-4 text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100" />
      ) : (
        <IconSelector className="size-4 text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100" />
      )}
    </Button>
  )
}

/** Non-sortable column header - just displays the title */
export function DataTableColumnHeaderStatic({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return <div className={cn(className)}>{title}</div>
}
