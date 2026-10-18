"use client"

import type { VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { toggleVariants } from "./toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { joined?: boolean }
>({})

type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    /** Butt the items together into one segmented control. */
    joined?: boolean
  }

function ToggleGroup({
  className,
  variant,
  size,
  joined = false,
  children,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-joined={joined}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-1 data-[joined=true]:gap-0 data-[joined=true]:[&>*:not(:first-child)]:rounded-l-none data-[joined=true]:[&>*:not(:first-child)]:border-l-0 data-[joined=true]:[&>*:not(:last-child)]:rounded-r-none",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, joined }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "focus-visible:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
export type { ToggleGroupProps }
