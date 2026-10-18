import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCheck } from "@tabler/icons-react"
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar"

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  args: { size: "default", shape: "circle" },
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg", "xl"] },
    shape: { control: "select", options: ["circle", "square"] },
  },
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

// Placeholder art served from packages/ui/public; real avatars come from Steam at runtime.
const placeholderAvatar = (n: 1 | 2 | 3 | 4) => `/avatars/placeholder-${n}.svg`

const sizes = ["sm", "default", "lg", "xl"] as const

const players = [
  { name: "Hazel", initials: "HZ" },
  { name: "drexx", initials: "DX" },
  { name: "Mintcake", initials: "MC" },
  { name: "Vantablack", initials: "VB" },
]

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={placeholderAvatar(1)} alt="Hazel" />
      <AvatarFallback>HZ</AvatarFallback>
    </Avatar>
  ),
}

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>DX</AvatarFallback>
    </Avatar>
  ),
}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      {sizes.map((size) => (
        <Avatar key={size} {...args} size={size}>
          <AvatarImage src={placeholderAvatar(1)} alt="Hazel" />
          <AvatarFallback>HZ</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
}

export const Square: Story = {
  args: { shape: "square", size: "lg" },
  render: (args) => (
    <div className="flex gap-2">
      {players.map((player) => (
        <Avatar key={player.name} {...args}>
          <AvatarFallback>{player.initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
}

export const WithBadge: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      <Avatar {...args}>
        <AvatarFallback>HZ</AvatarFallback>
        <AvatarBadge className="bg-green-500" />
      </Avatar>
      <Avatar {...args} size="lg">
        <AvatarFallback>DX</AvatarFallback>
        <AvatarBadge>
          <IconCheck />
        </AvatarBadge>
      </Avatar>
      <Avatar {...args} size="xl">
        <AvatarImage src={placeholderAvatar(2)} alt="Mintcake" />
        <AvatarFallback>MC</AvatarFallback>
        <AvatarBadge>
          <IconCheck />
        </AvatarBadge>
      </Avatar>
    </div>
  ),
}

export const Group: Story = {
  render: (args) => (
    <AvatarGroup>
      {players.map((player) => (
        <Avatar key={player.name} {...args}>
          <AvatarFallback>{player.initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
}
