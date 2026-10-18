import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const pageHeaderVariants = cva(
  "group/page-header flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b pb-4",
  {
    variants: {
      variant: {
        page: "",
        section: "gap-x-4",
      },
    },
    defaultVariants: {
      variant: "page",
    },
  },
)

function PageHeader({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof pageHeaderVariants>) {
  return (
    <div
      data-slot="page-header"
      data-variant={variant ?? "page"}
      className={cn(pageHeaderVariants({ variant }), className)}
      {...props}
    />
  )
}

function PageHeaderHeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-heading"
      className={cn(
        "flex min-w-0 flex-col gap-1 group-data-[variant=section]/page-header:gap-0.5",
        className,
      )}
      {...props}
    />
  )
}

type HeadingLevel = 1 | 2 | 3 | 4

function PageHeaderTitle({
  className,
  level = 1,
  ...props
}: React.ComponentProps<"h1"> & { level?: HeadingLevel }) {
  const Tag = `h${level}` as const

  return (
    <Tag
      data-slot="page-header-title"
      className={cn(
        "inline-flex flex-wrap items-center gap-2.5 text-5xl font-bold group-data-[variant=section]/page-header:text-3xl group-data-[variant=section]/page-header:font-semibold",
        className,
      )}
      {...props}
    />
  )
}

function PageHeaderDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-header-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

function PageHeaderActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

export {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  pageHeaderVariants,
}
