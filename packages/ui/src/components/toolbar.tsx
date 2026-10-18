import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { Separator } from "./separator"

function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      data-slot="toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

function ToolbarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="toolbar-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function ToolbarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="toolbar-separator"
      orientation="vertical"
      className={cn("mx-1 h-4", className)}
      {...props}
    />
  )
}

export { Toolbar, ToolbarGroup, ToolbarSeparator }
