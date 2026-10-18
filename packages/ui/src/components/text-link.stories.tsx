import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconUser } from "@tabler/icons-react"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Text Link",
  component: TextLink,
  tags: ["autodocs"],
  args: { href: "#", children: "Claim your player" },
  argTypes: {
    variant: { control: "select", options: ["default", "row", "muted", "nav"] },
  },
} satisfies Meta<typeof TextLink>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Row: Story = { args: { variant: "row", children: "Bangkok 24/7 Dust2" } }

export const Muted: Story = { args: { variant: "muted", children: "Find yourself" } }

export const Nav: Story = {
  render: (args) => (
    <nav aria-label="Primary" className="flex gap-1">
      <TextLink {...args} variant="nav" aria-current="page">
        Home
      </TextLink>
      <TextLink {...args} variant="nav">
        Rankings
      </TextLink>
      <TextLink {...args} variant="nav">
        Servers
      </TextLink>
      <TextLink {...args} variant="nav">
        <IconUser />
        Sign in
      </TextLink>
    </nav>
  ),
}

export const InSentence: Story = {
  render: () => (
    <p className="text-muted-foreground">
      Closest rival on the ladder: <TextLink href="#">quietstorm</TextLink> at #13, 6 skill behind.
    </p>
  ),
}
