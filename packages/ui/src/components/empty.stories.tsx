import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlus, IconServer, IconUserSearch } from "@tabler/icons-react"
import { Button } from "./button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"
import { Spinner } from "./spinner"

const meta = {
  title: "Components/Empty",
  component: Empty,
  tags: ["autodocs"],
  args: { className: "w-full max-w-md" },
} satisfies Meta<typeof Empty>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Empty {...args}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconUserSearch />
        </EmptyMedia>
        <EmptyTitle>No players found</EmptyTitle>
        <EmptyDescription>
          Nobody matching “tanuki” has played on Bangkok 24/7 Dust2. Check the spelling or clear the
          search.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="ghost">Clear search</Button>
      </EmptyContent>
    </Empty>
  ),
}

export const WithPrimaryAction: Story = {
  render: (args) => (
    <Empty {...args}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconServer />
        </EmptyMedia>
        <EmptyTitle>No servers yet</EmptyTitle>
        <EmptyDescription>
          Add a game server and the daemon starts collecting its events within a minute.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>
          <IconPlus />
          Add server
        </Button>
      </EmptyContent>
    </Empty>
  ),
}

export const Loading: Story = {
  render: (args) => (
    <Empty {...args}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner className="size-6" />
        </EmptyMedia>
        <EmptyTitle>Waiting for the first events</EmptyTitle>
        <EmptyDescription>
          The daemon is listening for Bangkok 24/7 Dust2. Stats appear as soon as the server sends
          its first log line.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="ghost" size="sm">
          Check log forwarding
        </Button>
      </EmptyContent>
    </Empty>
  ),
}

export const DashedBorder: Story = {
  ...Default,
  args: { className: "w-full max-w-md border" },
}
