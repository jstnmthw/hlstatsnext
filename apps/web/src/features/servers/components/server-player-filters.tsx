"use client"

import { useState } from "react"
import { Button, Input, Select, Badge } from "@repo/ui"
import { Filter, X } from "lucide-react"
import { type ServerPlayerFilters } from "../hooks/use-server-players"

interface ServerPlayerFiltersProps {
  filters: ServerPlayerFilters
  onFiltersChange: (filters: ServerPlayerFilters) => void
  onlineCount?: number
  recentCount?: number
  className?: string
}

export function ServerPlayerFiltersComponent({
  filters,
  onFiltersChange,
  onlineCount = 0,
  recentCount = 0,
  className,
}: ServerPlayerFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleFilterToggle = (key: keyof ServerPlayerFilters, value?: boolean | number) => {
    if (typeof value === "boolean" || value !== undefined) {
      onFiltersChange({ ...filters, [key]: value })
    } else {
      onFiltersChange({ ...filters, [key]: !filters[key] })
    }
  }

  const handleInputChange = (
    key: keyof ServerPlayerFilters,
    value: string | number | undefined,
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "" && value !== false && value !== 0,
  )

  return (
    <div className={className}>
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFilterToggle("onlineOnly")}
          className={filters.onlineOnly ? "bg-green-600 text-white border-green-600" : ""}
        >
          Online Only
          {onlineCount > 0 && (
            <Badge variant="outline" className="ml-2">
              {onlineCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFilterToggle("recentOnly")}
          className={filters.recentOnly ? "bg-blue-600 text-white border-blue-600" : ""}
        >
          Recent (7d)
          {recentCount > 0 && (
            <Badge variant="outline" className="ml-2">
              {recentCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFilterToggle("minKills", filters.minKills ? undefined : 10)}
          className={filters.minKills ? "bg-orange-600 text-white border-orange-600" : ""}
        >
          Min 10 Kills
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFilterToggle("favoritePlayersOnly")}
          className={
            filters.favoritePlayersOnly ? "bg-purple-600 text-white border-purple-600" : ""
          }
        >
          Regulars Only
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced
        </Button>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Minimum Skill Rating</label>
              <Input
                type="number"
                placeholder="e.g., 1000"
                value={filters.minSkill || ""}
                onChange={(e) =>
                  handleInputChange("minSkill", parseInt(e.target.value) || undefined)
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Minimum Kills</label>
              <Input
                type="number"
                placeholder="e.g., 50"
                value={filters.minKills || ""}
                onChange={(e) =>
                  handleInputChange("minKills", parseInt(e.target.value) || undefined)
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Minimum Time Played (hours)</label>
              <Input
                type="number"
                placeholder="e.g., 10"
                value={
                  filters.minConnectionTime ? Math.floor(filters.minConnectionTime / 3600) : ""
                }
                onChange={(e) =>
                  handleInputChange("minConnectionTime", (parseInt(e.target.value) || 0) * 3600)
                }
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Recent Activity Period</label>
              <Select
                value={filters.recentDays?.toString() || "7"}
                onValueChange={(value) => handleInputChange("recentDays", parseInt(value))}
                disabled={!filters.recentOnly}
              >
                <option value="1">Last 24 hours</option>
                <option value="3">Last 3 days</option>
                <option value="7">Last week</option>
                <option value="30">Last month</option>
                <option value="90">Last 3 months</option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Country Filter</label>
              <Input
                placeholder="e.g., United States, Canada"
                value={filters.country || ""}
                onChange={(e) => handleInputChange("country", e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground mb-2">Active filters:</div>
              <div className="flex flex-wrap gap-2">
                {filters.onlineOnly && (
                  <Badge variant="outline" colorScheme="green">
                    Online Only
                  </Badge>
                )}
                {filters.recentOnly && (
                  <Badge variant="outline" colorScheme="blue">
                    Recent ({filters.recentDays || 7}d)
                  </Badge>
                )}
                {filters.minKills && (
                  <Badge variant="outline" colorScheme="orange">
                    Min {filters.minKills} kills
                  </Badge>
                )}
                {filters.minSkill && (
                  <Badge variant="outline" colorScheme="purple">
                    Min {filters.minSkill} skill
                  </Badge>
                )}
                {filters.minConnectionTime && (
                  <Badge variant="outline" colorScheme="yellow">
                    Min {Math.floor(filters.minConnectionTime / 3600)}h played
                  </Badge>
                )}
                {filters.favoritePlayersOnly && (
                  <Badge variant="outline" colorScheme="pink">
                    Regulars Only
                  </Badge>
                )}
                {filters.country && (
                  <Badge variant="outline" colorScheme="light">
                    {filters.country}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
