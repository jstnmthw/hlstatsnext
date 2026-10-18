import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAward } from "@tabler/icons-react"
import { Button } from "./button"
import {
  Callout,
  CalloutActions,
  CalloutContent,
  CalloutDescription,
  CalloutMedia,
  CalloutTitle,
} from "./callout"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Callout",
  component: Callout,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { className: "w-4xl" },
  argTypes: {
    variant: { control: "select", options: ["default", "accent", "destructive", "dashed"] },
  },
} satisfies Meta<typeof Callout>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Callout {...args} className="w-4xl px-8 py-6">
      <CalloutMedia className="border-dashed border-foreground/30 font-bold">?</CalloutMedia>
      <CalloutContent>
        <CalloutTitle>Where do you stand?</CalloutTitle>
        <CalloutDescription>
          Sign in and claim your player to pin your row here and track your climb.
        </CalloutDescription>
      </CalloutContent>
      <CalloutActions>
        <Button variant="secondary">Sign in</Button>
        <Button>Claim your player</Button>
      </CalloutActions>
    </Callout>
  ),
}

export const Accent: Story = {
  args: { variant: "accent" },
  render: (args) => (
    <Callout {...args} className="w-md justify-start">
      <CalloutMedia className="border-primary-bright/50 text-primary-bright">
        <IconAward />
      </CalloutMedia>
      <CalloutContent>
        <CalloutTitle className="text-base font-bold">Award unlocked · Enlisted</CalloutTitle>
        <CalloutDescription>
          Your first award. 23 to go. The next one within reach: Bomb Squad, 7 / 10.
        </CalloutDescription>
      </CalloutContent>
    </Callout>
  ),
}

export const Note: Story = {
  render: (args) => (
    <Callout {...args} className="w-md flex-col items-stretch gap-1">
      <CalloutTitle className="text-base font-medium">Someone claimed your name?</CalloutTitle>
      <CalloutDescription>
        Claims are tied to the Steam ID the log parser sees, not the name. If a claim looks wrong,{" "}
        <TextLink href="#">contact an admin</TextLink>.
      </CalloutDescription>
    </Callout>
  ),
}

export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Callout {...args} className="w-md">
      <CalloutContent>
        <CalloutTitle className="text-destructive">Log parser offline</CalloutTitle>
        <CalloutDescription>
          No events received for 14 min. Kills are not being recorded.
        </CalloutDescription>
      </CalloutContent>
      <CalloutActions>
        <Button variant="secondary" size="sm">
          View daemon logs
        </Button>
      </CalloutActions>
    </Callout>
  ),
}

export const Dashed: Story = {
  args: { variant: "dashed" },
  render: (args) => (
    <Callout {...args} className="w-md">
      <CalloutContent>
        <CalloutTitle className="text-xs font-medium text-muted-foreground uppercase">
          Your rank
        </CalloutTitle>
        <CalloutDescription>
          Your stats are already logged. Claim the player to pin your rank here.
        </CalloutDescription>
      </CalloutContent>
      <CalloutActions>
        <TextLink href="#" className="font-semibold">
          Claim your player
        </TextLink>
        <TextLink href="#" variant="muted">
          Find yourself
        </TextLink>
      </CalloutActions>
    </Callout>
  ),
}
