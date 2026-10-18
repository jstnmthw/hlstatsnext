"use client"

import { IconCheck, IconCirclePlus } from "@tabler/icons-react"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { Badge } from "./badge"
import { Button, type ButtonProps } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Separator } from "./separator"

interface FacetedFilterOption {
  value: string
  label: React.ReactNode
  /** Facet count shown at the right edge of the row. */
  count?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  /** Extra classes for the label, e.g. a status colour. */
  className?: string
  /** Text matched by the search box when the label is not a plain string. */
  keywords?: string
}

interface FacetedFilterProps {
  title: React.ReactNode
  options: FacetedFilterOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  /** Show a search box above the options. Defaults to on for more than six options. */
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: React.ReactNode
  /** Badges shown on the trigger before collapsing to "N selected". */
  maxBadges?: number
  size?: ButtonProps["size"]
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  className?: string
  contentClassName?: string
  disabled?: boolean
}

function optionText(option: FacetedFilterOption): string {
  if (option.keywords) return option.keywords
  return typeof option.label === "string" ? option.label : option.value
}

function FacetedFilter({
  title,
  options,
  value,
  onValueChange,
  searchable = options.length > 6,
  searchPlaceholder,
  emptyText = "No results.",
  maxBadges = 2,
  size = "sm",
  align = "start",
  className,
  contentClassName,
  disabled,
}: FacetedFilterProps) {
  const [query, setQuery] = React.useState("")
  const selected = new Set(value)
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options.filter((option) => optionText(option).toLowerCase().includes(needle))
    : options

  const toggle = (optionValue: string) => {
    const next = new Set(selected)
    if (next.has(optionValue)) next.delete(optionValue)
    else next.add(optionValue)
    onValueChange(options.filter((o) => next.has(o.value)).map((o) => o.value))
  }

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          data-slot="faceted-filter-trigger"
          className={cn("border-dashed border-foreground/30 text-sm", className)}
        >
          <IconCirclePlus />
          {title}
          {selected.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              <span className="flex gap-1">
                {selected.size > maxBadges ? (
                  <Badge variant="secondary">{selected.size} selected</Badge>
                ) : (
                  options
                    .filter((option) => selected.has(option.value))
                    .map((option) => (
                      <Badge key={option.value} variant="secondary">
                        {option.label}
                      </Badge>
                    ))
                )}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        data-slot="faceted-filter-content"
        className={cn("flex w-52 flex-col p-1", contentClassName)}
      >
        {searchable && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder ?? (typeof title === "string" ? title : "Search")}
            aria-label={`Search ${typeof title === "string" ? title.toLowerCase() : "options"}`}
            className="-m-1 mb-1 h-8 w-[calc(100%+--spacing(2))] border-b bg-transparent px-2 outline-none placeholder:text-muted-foreground"
          />
        )}
        <div role="group" className="flex max-h-72 flex-col overflow-y-auto">
          {visible.length === 0 && (
            <span className="px-2 py-1.5 text-center text-muted-foreground">{emptyText}</span>
          )}
          {visible.map((option) => {
            const isSelected = selected.has(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(option.value)}
                className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left whitespace-nowrap outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-4 shrink-0 items-center justify-center border border-input text-transparent",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  <IconCheck className="size-3" stroke={3} />
                </span>
                {option.icon && <option.icon className="size-4 text-muted-foreground" />}
                <span className={cn("truncate", option.className)}>{option.label}</span>
                {option.count !== undefined && (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {selected.size > 0 && (
          <>
            <Separator className="-mx-1 my-1 w-auto" />
            <button
              type="button"
              onClick={() => onValueChange([])}
              className="w-full cursor-pointer px-2 py-1.5 text-center outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
            >
              Clear filters
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { FacetedFilter }
export type { FacetedFilterOption, FacetedFilterProps }
