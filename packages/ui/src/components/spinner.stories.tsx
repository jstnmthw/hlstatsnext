import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Spinner } from "./spinner"

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <Spinner {...args} className="size-3" />
      <Spinner {...args} />
      <Spinner {...args} className="size-6" />
      <Spinner {...args} className="size-8" />
    </div>
  ),
}

export const WithText: Story = {
  render: (args) => (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Spinner {...args} />
      Loading rankings…
    </div>
  ),
}

export const InButton: Story = {
  render: (args) => (
    <Button disabled>
      <Spinner {...args} />
      Saving…
    </Button>
  ),
}
