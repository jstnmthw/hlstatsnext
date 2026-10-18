import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCircleCheck, IconCrown } from "@tabler/icons-react"
import { colorSchemes } from "../lib/color-variants"
import { Badge } from "./badge"
import { PulseDot } from "./pulse-dot"

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Badge",
    variant: "primary",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "destructive",
        "live",
        "muted",
        "outline",
        "ghost",
        "solid",
      ],
    },
    colorScheme: { control: "select", options: [undefined, ...colorSchemes] },
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { children: "Busiest" } }

export const Secondary: Story = { args: { variant: "secondary", children: "Auto-refresh · 10 s" } }

export const Destructive: Story = { args: { variant: "destructive", children: "Offline" } }

export const Live: Story = {
  args: {
    variant: "live",
    children: (
      <>
        <PulseDot />
        39 players on now
      </>
    ),
  },
}

export const Muted: Story = { args: { variant: "muted", children: "Quiet" } }

export const Outline: Story = { args: { variant: "outline", children: "Not claimed" } }

export const WithIcon: Story = {
  args: {
    variant: "secondary",
    className: "text-tier-legend",
    children: (
      <>
        <IconCrown />
        Legend
      </>
    ),
  },
}

export const Semantic: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="live">Live</Badge>
      <Badge variant="muted">Muted</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  ),
}

export const AsLink: Story = {
  args: {
    asChild: true,
    variant: "secondary",
    children: <a href="#">Claimed</a>,
  },
}

export const ColorSchemes: Story = {
  args: { variant: "solid" },
  render: (args) => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {colorSchemes.map((colorScheme) => (
        <Badge key={colorScheme} {...args} colorScheme={colorScheme}>
          {colorScheme}
        </Badge>
      ))}
    </div>
  ),
}

export const ColorSchemeOutline: Story = {
  args: { variant: "outline", colorScheme: "green" },
  render: (args) => (
    <Badge {...args}>
      <IconCircleCheck />
      Online
    </Badge>
  ),
}
