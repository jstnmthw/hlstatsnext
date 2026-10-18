import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconArrowsSort, IconDownload, IconFilter } from "@tabler/icons-react"
import { Button } from "./button"
import { Separator } from "./separator"

const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  args: { orientation: "horizontal", decorative: true },
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <div className="space-y-1">
        <p className="font-medium">Bangkok 24/7 Dust2</p>
        <p className="text-muted-foreground">Counter-Strike 1.6 · 203.0.113.42:27015</p>
      </div>
      <Separator {...args} className="my-4" />
      <p className="text-muted-foreground">Last event received 12 seconds ago.</p>
    </div>
  ),
}

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-8 items-center gap-2">
      <Button variant="ghost" size="sm">
        <IconFilter />
        Filter
      </Button>
      <Separator {...args} />
      <Button variant="ghost" size="sm">
        <IconArrowsSort />
        Sort
      </Button>
      <Separator {...args} />
      <Button variant="ghost" size="sm">
        <IconDownload />
        Export
      </Button>
    </div>
  ),
}

export const InlineLinks: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-4">
      <span>Rankings</span>
      <Separator {...args} />
      <span>Players</span>
      <Separator {...args} />
      <span>Maps</span>
    </div>
  ),
}
