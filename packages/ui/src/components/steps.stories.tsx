import type { Meta, StoryObj } from "@storybook/react-vite"
import { Step, Steps } from "./steps"

const meta = {
  title: "Components/Steps",
  component: Steps,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { className: "w-2xl", "aria-label": "Progress" },
} satisfies Meta<typeof Steps>

export default meta

type Story = StoryObj<typeof meta>

export const FirstStep: Story = {
  render: (args) => (
    <Steps {...args}>
      <Step status="current">Find your player</Step>
      <Step>Verify in game</Step>
      <Step>Unlocked</Step>
    </Steps>
  ),
}

export const SecondStep: Story = {
  render: (args) => (
    <Steps {...args}>
      <Step status="complete">Find your player</Step>
      <Step status="current">Verify in game</Step>
      <Step>Unlocked</Step>
    </Steps>
  ),
}

export const Done: Story = {
  render: (args) => (
    <Steps {...args}>
      <Step status="complete">Find your player</Step>
      <Step status="complete">Verify in game</Step>
      <Step status="current">Unlocked</Step>
    </Steps>
  ),
}
