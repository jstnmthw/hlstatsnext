import { cn } from "@repo/ui"
import React from "react"

interface VerticalListProps {
  className?: string
  children: React.ReactNode
}

interface VerticalListHeaderProps {
  className?: string
  children: React.ReactNode
}

interface VerticalListItemProps {
  className?: string
  children: React.ReactNode
}

export const VerticalList = ({ className, children }: VerticalListProps) => {
  return (
    <div className={cn("col-span-2 border border-border rounded-lg", className)}>{children}</div>
  )
}

export const VerticalListHeader = ({ className, children }: VerticalListHeaderProps) => {
  return (
    <h2 className={cn("uppercase tracking-tight text-sm font-bold p-2", className)}>{children}</h2>
  )
}

export const VerticalListItem = ({ className, children }: VerticalListItemProps) => {
  return (
    <li className={cn("border-t border-border py-1.5 hover:bg-muted/25", className)}>{children}</li>
  )
}
