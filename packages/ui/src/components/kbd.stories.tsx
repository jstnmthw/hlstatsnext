import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCommand } from "@tabler/icons-react"
import { Kbd, KbdGroup } from "./kbd"

const meta = {
  title: "Components/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "⌘K" },
} satisfies Meta<typeof Kbd>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Group: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>Ctrl</Kbd>
      <span className="text-muted-foreground">+</span>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>
        <IconCommand />
      </Kbd>
      <Kbd>/</Kbd>
    </KbdGroup>
  ),
}

export const InText: Story = {
  render: () => (
    <p className="text-muted-foreground">
      Press <Kbd>/</Kbd> to search players and servers.
    </p>
  ),
}
