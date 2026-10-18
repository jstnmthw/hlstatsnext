import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { FacetedFilter } from "./faceted-filter"
import { Input } from "./input"
import { Label } from "./label"
import { Switch } from "./switch"
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "./toolbar"

const meta = {
  title: "Components/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { className: "w-4xl", "aria-label": "Filter servers" },
} satisfies Meta<typeof Toolbar>

export default meta

type Story = StoryObj<typeof meta>

const statusOptions = [
  { value: "online", label: "Online", count: 3, className: "text-primary-bright" },
  { value: "idle", label: "Idle", count: 1 },
  { value: "offline", label: "Offline", count: 2, className: "text-destructive" },
]

const mapOptions = [
  { value: "de_dust2", label: "de_dust2", count: 1 },
  { value: "de_inferno", label: "de_inferno", count: 1 },
  { value: "fy_pool_day", label: "fy_pool_day", count: 1 },
  { value: "aim_map", label: "aim_map", count: 1 },
]

function FilterBar(props: React.ComponentProps<typeof Toolbar>) {
  const [status, setStatus] = useState<string[]>(["online"])
  const [maps, setMaps] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [columns, setColumns] = useState({ address: true, map: true, kills: true, uptime: false })
  const filtered = status.length > 0 || maps.length > 0 || search !== ""

  return (
    <Toolbar {...props}>
      <Input
        type="search"
        placeholder="Filter servers, maps…"
        aria-label="Filter servers and maps"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-60"
      />
      <FacetedFilter
        title="Status"
        options={statusOptions}
        value={status}
        onValueChange={setStatus}
      />
      <FacetedFilter title="Map" options={mapOptions} value={maps} onValueChange={setMaps} />
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus([])
            setMaps([])
            setSearch("")
          }}
        >
          Reset
          <IconX />
        </Button>
      )}
      <ToolbarGroup className="ml-auto">
        <Switch id="active-only" defaultChecked />
        <Label htmlFor="active-only" className="whitespace-nowrap">
          Seen in the last 30 days
        </Label>
        <ToolbarSeparator />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconAdjustmentsHorizontal />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            {(Object.keys(columns) as Array<keyof typeof columns>).map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={columns[key]}
                onCheckedChange={(checked) => setColumns({ ...columns, [key]: checked })}
                className="capitalize"
              >
                {key}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarGroup>
    </Toolbar>
  )
}

export const FilterBar_: Story = {
  name: "Filter bar",
  render: (args) => <FilterBar {...args} />,
}

export const Simple: Story = {
  render: (args) => (
    <Toolbar {...args}>
      <Input
        type="search"
        placeholder="Filter awards…"
        aria-label="Filter awards"
        className="h-8 w-60"
      />
      <ToolbarSeparator />
      <Button variant="outline" size="sm">
        Yesterday
      </Button>
      <Button variant="outline" size="sm">
        Last Sunday
      </Button>
    </Toolbar>
  ),
}
