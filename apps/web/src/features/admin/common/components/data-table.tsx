"use client"

import { DataTable, DataTableProps } from "@/features/common/components/data-table"
import { useDataTableUrl } from "@/features/common/hooks/use-data-table-url"
import { ColumnDef } from "@tanstack/react-table"
import {
  userColumns,
  userFilterConfig,
  UserListItem,
} from "@/features/admin/users/components/user-columns"
import {
  gameColumns,
  gameFilterConfig,
  GameListItem,
} from "@/features/admin/games/components/game-columns"
import {
  playerColumns,
  playerFilterConfig,
  PlayerListItem,
} from "@/features/admin/players/components/player-columns"
import {
  serverColumns,
  serverFilterConfig,
  ServerListItem,
} from "@/features/admin/servers/components/server-columns"

interface BaseAdminTableProps
  extends Omit<DataTableProps<unknown>, "columns" | "filterPlaceholder" | "serverConfig"> {
  totalCount: number
  currentPage: number
  pageSize: number
  sortField?: string
  sortOrder: "asc" | "desc"
  searchValue: string
}

interface UsersTableProps extends BaseAdminTableProps {
  tableType: "users"
  data: UserListItem[]
}

interface GamesTableProps extends BaseAdminTableProps {
  tableType: "games"
  data: GameListItem[]
}

interface PlayersTableProps extends BaseAdminTableProps {
  tableType: "players"
  data: PlayerListItem[]
}

interface ServersTableProps extends BaseAdminTableProps {
  tableType: "servers"
  data: ServerListItem[]
}

type AdminTableProps = UsersTableProps | GamesTableProps | PlayersTableProps | ServersTableProps

export function AdminTable(props: AdminTableProps) {
  const { tableType, data, ...otherProps } = props

  if (tableType === "users") {
    return (
      <AdminTableContent
        data={data as UserListItem[]}
        columns={userColumns()}
        filterPlaceholder={userFilterConfig.placeholder}
        config={{
          defaultSortField: "username",
          defaultSortOrder: "asc",
          defaultPageSize: 10,
        }}
        {...otherProps}
      />
    )
  }

  if (tableType === "games") {
    return (
      <AdminTableContent
        data={data as GameListItem[]}
        columns={gameColumns()}
        filterPlaceholder={gameFilterConfig.placeholder}
        config={{
          defaultSortField: "name",
          defaultSortOrder: "asc",
          defaultPageSize: 10,
        }}
        {...otherProps}
      />
    )
  }

  if (tableType === "players") {
    return (
      <AdminTableContent
        data={data as PlayerListItem[]}
        columns={playerColumns()}
        filterPlaceholder={playerFilterConfig.placeholder}
        config={{
          defaultSortField: "lastName",
          defaultSortOrder: "asc",
          defaultPageSize: 10,
        }}
        {...otherProps}
      />
    )
  }

  if (tableType === "servers") {
    return (
      <AdminTableContent
        data={data as ServerListItem[]}
        columns={serverColumns()}
        filterPlaceholder={serverFilterConfig.placeholder}
        config={{
          defaultSortField: "name",
          defaultSortOrder: "asc",
          defaultPageSize: 10,
        }}
        {...otherProps}
      />
    )
  }

  throw new Error(`Unknown table type: ${tableType}`)
}

function AdminTableContent<T>({
  data,
  columns,
  filterPlaceholder,
  config,
  currentPage = 1,
  pageSize = 10,
  sortField,
  sortOrder = "asc",
  searchValue = "",
  ...otherProps
}: {
  data: T[]
  columns: ColumnDef<T>[]
  filterPlaceholder: string
  config: {
    defaultSortField: string
    defaultSortOrder: "asc" | "desc"
    defaultPageSize: number
  }
  currentPage?: number
  pageSize?: number
  sortField?: string
  sortOrder?: "asc" | "desc"
  searchValue?: string
} & Omit<
  DataTableProps<T>,
  | "data"
  | "columns"
  | "filterPlaceholder"
  | "serverConfig"
  | "onPageChange"
  | "onSort"
  | "onSearch"
  | "onRefresh"
  | "isLoading"
>) {
  // Use URL hooks for server-side functionality
  const { handleSort, handlePageChange, handleSearch, handleRefresh, isPending } =
    useDataTableUrl(config)

  // Create wrapper functions that match DataTable's expected signatures
  const handlePageChangeWrapper = (page: number) => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handlePageChange(page, currentState)
  }

  const handleSortWrapper = (field: string, order: "asc" | "desc") => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handleSort(`${field}:${order}`, currentState)
  }

  const handleSearchWrapper = (value: string) => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handleSearch(value, currentState)
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      filterPlaceholder={filterPlaceholder}
      serverConfig={config}
      currentPage={currentPage}
      pageSize={pageSize}
      sortField={sortField}
      sortOrder={sortOrder}
      searchValue={searchValue}
      enableActions={true}
      onPageChange={handlePageChangeWrapper}
      onSort={handleSortWrapper}
      onSearch={handleSearchWrapper}
      onRefresh={handleRefresh}
      isLoading={isPending}
      {...otherProps}
    />
  )
}
