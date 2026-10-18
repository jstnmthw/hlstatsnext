import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Button } from "./button"
import { FlagIcon } from "./flag-icon"
import { Input } from "./input"
import { Label } from "./label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover"

const meta = {
  title: "Components/Popover",
  component: Popover,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Server info</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Bangkok 24/7 Dust2</PopoverTitle>
          <PopoverDescription>
            Counter-Strike 1.6 on 203.0.113.42:27015. Playing de_dust2 with 14 of 32 slots filled.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
}

export const Open: Story = { ...Default, args: { defaultOpen: true } }

export const AlignStart: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="ghost">
          <FlagIcon code="th" name="Thailand" />
          Hazel
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid gap-3">
        <PopoverHeader>
          <PopoverTitle>Hazel</PopoverTitle>
          <PopoverDescription>Thailand · Legend · 18,420 kills</PopoverDescription>
        </PopoverHeader>
        <Button variant="outline" size="sm" className="justify-self-start">
          View profile
        </Button>
      </PopoverContent>
    </Popover>
  ),
}

export const WithForm: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Display name</Button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-4">
        <PopoverHeader>
          <PopoverTitle>Display name</PopoverTitle>
          <PopoverDescription>Shown on rankings instead of your in-game name.</PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2">
          <Label htmlFor="display-name">Name</Label>
          <Input id="display-name" defaultValue="Hazel" />
        </div>
        <Button size="sm" className="justify-self-end">
          Save
        </Button>
      </PopoverContent>
    </Popover>
  ),
}
