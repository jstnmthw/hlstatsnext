import { IconChevronLeft, IconChevronRight, IconDots } from "@tabler/icons-react"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { Button, buttonClassName, type ButtonProps } from "./button"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

interface PaginationLinkProps extends React.ComponentProps<"a">, Pick<ButtonProps, "size"> {
  isActive?: boolean
  disabled?: boolean
}

function PaginationLink({
  className,
  isActive,
  disabled,
  size = "sm",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      data-slot="pagination-link"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={buttonClassName({
        variant: isActive ? "secondary" : "ghost",
        size,
        className: cn("min-w-8", className),
      })}
      {...props}
    />
  )
}

function PaginationPrevious({ className, children, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to previous page" className={cn("px-2", className)} {...props}>
      <IconChevronLeft />
      {children ?? <span>Previous</span>}
    </PaginationLink>
  )
}

function PaginationNext({ className, children, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to next page" className={cn("px-2", className)} {...props}>
      {children ?? <span>Next</span>}
      <IconChevronRight />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <IconDots className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

/** Button-based variant for client-side paging without hrefs. */
function PaginationButton({
  isActive,
  size = "sm",
  className,
  ...props
}: ButtonProps & { isActive?: boolean }) {
  return (
    <Button
      data-slot="pagination-button"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      variant={isActive ? "secondary" : "ghost"}
      size={size}
      className={cn("min-w-8", className)}
      {...props}
    />
  )
}

/** "Showing 1–15 of 2,106" style summary placed beside the links. */
function PaginationSummary({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="pagination-summary"
      className={cn("text-muted-foreground tabular-nums", className)}
      {...props}
    />
  )
}

export {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
}
export type { PaginationLinkProps }
