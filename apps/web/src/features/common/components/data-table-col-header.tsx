import { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn, Button } from "@repo/ui"

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
        className={cn("-ml-3 h-8 group", className)}
        onClick={handleClick}
      >
        <span className="text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200">
          {title}
        </span>
        {isCurrentSort && sortOrder === "desc" ? (
          <ArrowDown className="size-4 text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200" />
        ) : isCurrentSort && sortOrder === "asc" ? (
          <ArrowUp className="size-4 text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200" />
        ) : (
          <ChevronsUpDown className="size-4 text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200" />
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
        <ArrowDown className="size-3" />
      ) : column.getIsSorted() === "asc" ? (
        <ArrowUp className="size-3" />
      ) : (
        <ChevronsUpDown className="size-3" />
      )}
    </Button>
  )
}
