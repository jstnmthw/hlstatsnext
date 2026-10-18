import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconCircleCheck,
  IconCrown,
  IconInfoCircle,
  IconStar,
  IconX,
} from "@tabler/icons-react"
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

export const IconOnly: Story = {
  args: { variant: "solid" },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <Badge {...args} colorScheme="blue" aria-label="Notifications">
        <IconBell />
      </Badge>
      <Badge {...args} colorScheme="green" aria-label="Verified">
        <IconCheck />
      </Badge>
      <Badge {...args} colorScheme="red" aria-label="Failed">
        <IconX />
      </Badge>
      <Badge {...args} colorScheme="amber" aria-label="Warning">
        <IconAlertTriangle />
      </Badge>
      <Badge {...args} colorScheme="purple" aria-label="Featured">
        <IconStar />
      </Badge>
      <Badge {...args} colorScheme="indigo" aria-label="Info">
        <IconInfoCircle />
      </Badge>
    </div>
  ),
}

export const Counts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="solid" colorScheme="red">
          1
        </Badge>
        <Badge variant="solid" colorScheme="red">
          12
        </Badge>
        <Badge variant="solid" colorScheme="red">
          99+
        </Badge>
        <Badge variant="solid" colorScheme="blue">
          42
        </Badge>
        <Badge variant="solid" colorScheme="green">
          100
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" colorScheme="zinc">
          v1.0.0
        </Badge>
        <Badge variant="outline" colorScheme="blue">
          Beta
        </Badge>
        <Badge variant="outline" colorScheme="green">
          Stable
        </Badge>
        <Badge variant="outline" colorScheme="amber">
          RC1
        </Badge>
      </div>
    </div>
  ),
}

export const Statuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="solid" colorScheme="green">
          <PulseDot className="animate-none bg-current" />
          Online
        </Badge>
        <Badge variant="solid" colorScheme="amber">
          <PulseDot className="animate-none bg-current" />
          Away
        </Badge>
        <Badge variant="solid" colorScheme="red">
          <PulseDot className="animate-none bg-current" />
          Busy
        </Badge>
        <Badge variant="solid" colorScheme="zinc">
          <PulseDot className="animate-none bg-current" />
          Offline
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" colorScheme="green">
          <IconCheck />
          Operational
        </Badge>
        <Badge variant="outline" colorScheme="amber">
          <IconAlertTriangle />
          Degraded
        </Badge>
        <Badge variant="outline" colorScheme="red">
          <IconX />
          Down
        </Badge>
        <Badge variant="outline" colorScheme="blue">
          <IconInfoCircle />
          Maintenance
        </Badge>
      </div>
    </div>
  ),
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

export const ColorSchemeAsLink: Story = {
  args: { asChild: true },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <Badge {...args} variant="solid" colorScheme="blue">
        <a href="#">Clickable</a>
      </Badge>
      <Badge {...args} variant="outline" colorScheme="purple">
        <a href="#">
          <IconStar />
          Featured
        </a>
      </Badge>
      <Badge {...args} variant="ghost" colorScheme="green">
        <a href="#">View details</a>
      </Badge>
    </div>
  ),
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
  args: { variant: "outline" },
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

export const ColorSchemeGhost: Story = {
  args: { variant: "ghost" },
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

export const ColorSchemeWithIcon: Story = {
  args: { variant: "outline", colorScheme: "green" },
  render: (args) => (
    <Badge {...args}>
      <IconCircleCheck />
      Online
    </Badge>
  ),
}
