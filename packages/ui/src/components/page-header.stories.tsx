import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { Button } from "./button"
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from "./page-header"
import { PulseDot } from "./pulse-dot"
import { TextLink } from "./text-link"

const meta = {
  title: "Components/Page Header",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { className: "w-4xl" },
  argTypes: {
    variant: { control: "select", options: ["page", "section"] },
  },
} satisfies Meta<typeof PageHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Page: Story = {
  render: (args) => (
    <PageHeader {...args}>
      <PageHeaderHeading>
        <PageHeaderTitle>Rankings</PageHeaderTitle>
        <PageHeaderDescription>
          2,106 ranked players · Season 3 ends in 41 days · recalculated every 5 min
        </PageHeaderDescription>
      </PageHeaderHeading>
      <TextLink href="#">Find a player</TextLink>
    </PageHeader>
  ),
}

export const WithLiveBadge: Story = {
  render: (args) => (
    <PageHeader {...args}>
      <PageHeaderHeading>
        <PageHeaderTitle>
          Servers
          <Badge variant="live">
            <PulseDot />
            39 players on now
          </Badge>
        </PageHeaderTitle>
        <PageHeaderDescription>
          Status polled every 30 s · pick All games to browse every server grouped by game
        </PageHeaderDescription>
      </PageHeaderHeading>
    </PageHeader>
  ),
}

export const WithActions: Story = {
  render: (args) => (
    <PageHeader {...args}>
      <PageHeaderHeading>
        <PageHeaderTitle>Awards</PageHeaderTitle>
        <PageHeaderDescription>
          14 daily awards, one winner each at midnight · 24 achievements you keep
        </PageHeaderDescription>
      </PageHeaderHeading>
      <PageHeaderActions>
        <Button variant="ghost">Sign in to see your progress</Button>
        <Button>Claim your player</Button>
      </PageHeaderActions>
    </PageHeader>
  ),
}

export const Section: Story = {
  args: { variant: "section" },
  render: (args) => (
    <PageHeader {...args}>
      <PageHeaderHeading>
        <PageHeaderTitle level={2}>Games</PageHeaderTitle>
        <PageHeaderDescription>
          Sorted by players online. Each game has its own rankings, servers and awards.
        </PageHeaderDescription>
      </PageHeaderHeading>
      <TextLink href="#">All servers, every game</TextLink>
    </PageHeader>
  ),
}

export const SectionWithBadge: Story = {
  args: { variant: "section" },
  render: (args) => (
    <PageHeader {...args}>
      <PageHeaderHeading>
        <PageHeaderTitle level={2}>
          Playing right now
          <Badge variant="live">
            <PulseDot />
            51 online
          </Badge>
        </PageHeaderTitle>
        <PageHeaderDescription>
          Everyone on a server this minute, highest rank first
        </PageHeaderDescription>
      </PageHeaderHeading>
      <TextLink href="#">All servers</TextLink>
    </PageHeader>
  ),
}
