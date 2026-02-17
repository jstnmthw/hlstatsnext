"use client"

import { createContext, useContext } from "react"

interface DataTableContextValue {
  sortField: string
  sortOrder: "asc" | "desc"
  onSort: (field: string) => void
  onRefresh: () => void
  isPending: boolean
}

const DataTableContext = createContext<DataTableContextValue | null>(null)

export function DataTableProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: DataTableContextValue
}) {
  return <DataTableContext.Provider value={value}>{children}</DataTableContext.Provider>
}

export function useDataTableContext() {
  const context = useContext(DataTableContext)
  if (!context) {
    throw new Error("useDataTableContext must be used within a DataTableProvider")
  }
  return context
}
