import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Label } from "./label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"

const servers = [
  { value: "bangkok", label: "Bangkok 24/7 Dust2" },
  { value: "deathmatch", label: "Deathmatch Arena" },
  { value: "crossfire", label: "Crossfire Rotation" },
]

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  args: { disabled: false, onValueChange: fn() },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-60">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        {servers.map((server) => (
          <SelectItem key={server.value} value={server.value}>
            {server.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
}

export const Grouped: Story = {
  args: { defaultValue: "bangkok" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-60">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Counter-Strike 1.6</SelectLabel>
          <SelectItem value="bangkok">Bangkok 24/7 Dust2</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Half-Life Deathmatch</SelectLabel>
          <SelectItem value="deathmatch">Deathmatch Arena</SelectItem>
          <SelectItem value="crossfire">Crossfire Rotation</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Team Fortress Classic</SelectLabel>
          <SelectItem value="tfc" disabled>
            No servers yet
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const Sort: Story = {
  args: { defaultValue: "skill" },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort-by" className="text-sm text-muted-foreground">
        Sort by
      </Label>
      <Select {...args}>
        <SelectTrigger id="sort-by" size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="skill">Skill</SelectItem>
          <SelectItem value="kills">Kills</SelectItem>
          <SelectItem value="deaths">Deaths</SelectItem>
          <SelectItem value="kd">Kill/death ratio</SelectItem>
          <SelectItem value="last-seen">Last seen</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "bangkok" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-60">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        {servers.map((server) => (
          <SelectItem key={server.value} value={server.value}>
            {server.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
}

export const Invalid: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-invalid className="w-60">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        {servers.map((server) => (
          <SelectItem key={server.value} value={server.value}>
            {server.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
}
