"use client"

import { FacetedFilterOption } from "@/features/common/types/data-table"
import {
  Badge,
  Button,
  Checkbox,
  IconPlus,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from "@repo/ui"

interface DataTableFacetedFilterProps {
  title: string
  options: FacetedFilterOption[]
  selectedValues: string[]
  onSelectionChange: (values: string[]) => void
}

export function DataTableFacetedFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
}: DataTableFacetedFilterProps) {
  const selectedSet = new Set(selectedValues)

  const handleToggle = (value: string) => {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onSelectionChange(Array.from(next))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <IconPlus className="size-4" />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="flex gap-1">
                {selectedSet.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedSet.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedSet.has(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="max-h-[300px] overflow-auto p-1">
          {options.map((option) => {
            const isSelected = selectedSet.has(option.value)
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => handleToggle(option.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleToggle(option.value)
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox checked={isSelected} className="pointer-events-none" />
                {option.icon && <option.icon className="size-4 text-muted-foreground" />}
                <span>{option.label}</span>
              </div>
            )
          })}
        </div>
        {selectedSet.size > 0 && (
          <>
            <Separator />
            <div className="p-1">
              <button
                onClick={() => onSelectionChange([])}
                className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-center text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Clear filters
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
