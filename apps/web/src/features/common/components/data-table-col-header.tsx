import { Button, cn, IconArrowDown, IconArrowUp, IconSelector } from "@repo/ui"
import { Column } from "@tanstack/react-table"

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column?: Column<TData, TValue>
  title: string
  field?: string
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  field,
  sortField,
  sortOrder,
  onSort,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column && field && onSort) {
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

  if (!column || !column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  const handleClick = () => {
    const currentSort = column.getIsSorted()
    if (currentSort === "asc") {
      column.toggleSorting(true) // desc
    } else if (currentSort === "desc") {
      column.clearSorting() // no sort
    } else {
      column.toggleSorting(false) // asc
    }
  }

  return (
    <Button variant="ghost" size="sm" className={cn("-ml-3 h-8", className)} onClick={handleClick}>
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <IconArrowDown className="size-3" />
      ) : column.getIsSorted() === "asc" ? (
        <IconArrowUp className="size-3" />
      ) : (
        <IconSelector className="size-3" />
      )}
    </Button>
  )
}
