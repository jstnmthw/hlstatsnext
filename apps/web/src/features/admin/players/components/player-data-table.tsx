"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { PlayerListItem } from "./player-columns"
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
  DropdownMenuItem,
  Settings2Icon,
} from "@repo/ui"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { formatDate } from "@/lib/datetime-util"
import { RotateCw, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react"

interface PlayerDataTableProps {
  data: PlayerListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

export function PlayerDataTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: PlayerDataTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [searchValue, setSearchValue] = useState(search)

  const updateURL = useCallback(
    (params: Record<string, string | undefined>) => {
      const searchParams = new URLSearchParams()

      // Add non-default values to URL
      if (params.page && params.page !== "1") {
        searchParams.set("page", params.page)
      }
      if (params.sortField && params.sortField !== "lastName") {
        searchParams.set("sortField", params.sortField)
      }
      if (params.sortOrder && params.sortOrder !== "asc") {
        searchParams.set("sortOrder", params.sortOrder)
      }
      if (params.search) {
        searchParams.set("search", params.search)
      }

      const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
      startTransition(() => {
        router.push(url)
      })
    },
    [router, pathname],
  )

  const handleSort = useCallback(
    (columnId: string) => {
      const newOrder = sortField === columnId && sortOrder === "asc" ? "desc" : "asc"
      updateURL({
        sortField: columnId,
        sortOrder: newOrder,
        search: search || undefined,
      })
    },
    [sortField, sortOrder, search, updateURL],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      updateURL({
        page: page.toString(),
        sortField: sortField !== "lastName" ? sortField : undefined,
        sortOrder: sortOrder !== "asc" ? sortOrder : undefined,
        search: search || undefined,
      })
    },
    [sortField, sortOrder, search, updateURL],
  )

  const handleSearchSubmit = useCallback(() => {
    updateURL({
      search: searchValue || undefined,
      sortField: sortField !== "lastName" ? sortField : undefined,
      sortOrder: sortOrder !== "asc" ? sortOrder : undefined,
    })
  }, [searchValue, sortField, sortOrder, updateURL])

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  // Create simple columns inline
  const tableColumns = useMemo(
    (): ColumnDef<PlayerListItem>[] => [
      {
        accessorKey: "playerId",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("playerId")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            ID
            {sortField === "playerId" && sortOrder === "asc" && (
              <ArrowUp className="ml-2 h-4 w-4" />
            )}
            {sortField === "playerId" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => <span className="pl-2">{row.original.playerId}</span>,
      },
      {
        accessorKey: "lastName",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("lastName")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Name
            {sortField === "lastName" && sortOrder === "asc" && (
              <ArrowUp className="ml-2 h-4 w-4" />
            )}
            {sortField === "lastName" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: "email",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("email")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Email
            {sortField === "email" && sortOrder === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
            {sortField === "email" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: "skill",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("skill")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Skill
            {sortField === "skill" && sortOrder === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
            {sortField === "skill" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: "kills",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("kills")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Kills
            {sortField === "kills" && sortOrder === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
            {sortField === "kills" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: "deaths",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("deaths")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Deaths
            {sortField === "deaths" && sortOrder === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
            {sortField === "deaths" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: "lastEvent",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("lastEvent")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Last Event
            {sortField === "lastEvent" && sortOrder === "asc" && (
              <ArrowUp className="ml-2 h-4 w-4" />
            )}
            {sortField === "lastEvent" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const player = row.original
          if (!player.lastEvent) return <span>-</span>
          return <span>{formatDate(player.lastEvent)}</span>
        },
      },
      {
        accessorKey: "lastSkillChange",
        header: () => (
          <Button
            variant="ghost"
            onClick={() => handleSort("lastSkillChange")}
            className="h-8 text-left justify-start p-2 -ml-2"
          >
            Last Skill Change
            {sortField === "lastSkillChange" && sortOrder === "asc" && (
              <ArrowUp className="ml-2 h-4 w-4" />
            )}
            {sortField === "lastSkillChange" && sortOrder === "desc" && (
              <ArrowDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const player = row.original
          if (!player.lastSkillChange) return <span>-</span>
          return <span>{formatDate(player.lastSkillChange)}</span>
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="flex items-center justify-end pr-3 pl-1">
            <Button
              variant="ghost"
              className="size-8 p-0"
              onClick={handleRefresh}
              disabled={isPending}
            >
              <RotateCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const player = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center justify-end pr-3 pl-1">
                  <Button variant="ghost" className="size-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(player.playerId)}>
                  Copy player ID
                </DropdownMenuItem>
                <DropdownMenuItem>View player</DropdownMenuItem>
                <DropdownMenuItem>View player details</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [sortField, sortOrder, handleSort, handleRefresh, isPending],
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      columnVisibility,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    pageCount: Math.ceil(totalCount / pageSize),
  })

  const paginationInfo = useMemo(() => {
    const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
    const endItem = Math.min(currentPage * pageSize, totalCount)
    const canPreviousPage = currentPage > 1
    const canNextPage = currentPage < Math.ceil(totalCount / pageSize)

    return { startItem, endItem, totalCount, canPreviousPage, canNextPage }
  }, [currentPage, pageSize, totalCount])

  return (
    <>
      <div className="flex items-center py-4">
        <div className="flex gap-2">
          <Input
            placeholder="Filter players..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearchSubmit()
              }
            }}
            className="max-w-sm dark:bg-zinc-950"
            disabled={isPending}
          />
          <Button variant="outline" onClick={handleSearchSubmit} disabled={isPending}>
            Search
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" colorScheme="light" className="ml-auto text-base">
              <Settings2Icon className="size-4" /> View
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
            {isPending ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length > 0 ? (
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
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {paginationInfo.startItem} to {paginationInfo.endItem} of{" "}
          {paginationInfo.totalCount} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!paginationInfo.canPreviousPage || isPending}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!paginationInfo.canNextPage || isPending}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}
