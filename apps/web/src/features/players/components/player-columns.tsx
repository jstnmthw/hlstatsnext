"use client"

import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { PublicPlayerItem } from "./player-config"

export { playerPageTableConfig } from "./player-config"
export type { PublicPlayerItem } from "./player-config"

export const playerPageColumns: ColumnDef<PublicPlayerItem>[] = [
  {
    id: "rank",
    header: () => <span className="text-muted-foreground">#</span>,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination
      return (
        <span className="text-muted-foreground tabular-nums">
          {pageIndex * pageSize + row.index + 1}
        </span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "lastName",
    header: () => <DataTableColumnHeader title="Player" field="lastName" />,
    cell: ({ row }) => (
      <Link
        href={`/players/${row.original.playerId}`}
        className="font-medium hover:text-primary-bright hover:underline"
      >
        {row.original.lastName}
      </Link>
    ),
  },
  {
    accessorKey: "skill",
    header: () => <DataTableColumnHeader title="Skill" field="skill" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.skill.toLocaleString()}</span>,
  },
  {
    accessorKey: "kills",
    header: () => <DataTableColumnHeader title="Kills" field="kills" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.kills.toLocaleString()}</span>,
  },
  {
    accessorKey: "deaths",
    header: () => <DataTableColumnHeader title="Deaths" field="deaths" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.deaths.toLocaleString()}</span>,
  },
  {
    id: "kd",
    header: "K/D",
    cell: ({ row }) => {
      const kd = (row.original.kills / (row.original.deaths || 1)).toFixed(2)
      return <span className="text-muted-foreground tabular-nums">{kd}</span>
    },
    enableSorting: false,
  },
  {
    accessorKey: "country",
    header: () => <DataTableColumnHeader title="Country" field="country" />,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.country || "—"}</span>,
  },
]
