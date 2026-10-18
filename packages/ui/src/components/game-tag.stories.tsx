import type { Meta, StoryObj } from "@storybook/react-vite"
import { GameTag } from "./game-tag"

const meta = {
  title: "Components/Game Tag",
  component: GameTag,
  tags: ["autodocs"],
  args: { code: "CS" },
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "default", "lg", "xl"] },
    muted: { control: "boolean" },
    outline: { control: "boolean" },
  },
} satisfies Meta<typeof GameTag>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <GameTag {...args} size="xs" />
      <GameTag {...args} size="sm" />
      <GameTag {...args} size="default" />
      <GameTag {...args} size="lg" />
      <GameTag {...args} size="xl" />
    </div>
  ),
}

export const Muted: Story = { args: { code: "NS", muted: true } }

export const Outline: Story = { args: { code: "ALL", outline: true } }

export const WithName: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {[
        ["CS", "Counter-Strike 1.6"],
        ["HL", "Half-Life Deathmatch"],
        ["TFC", "Team Fortress Classic"],
        ["DoD", "Day of Defeat"],
      ].map(([code, name]) => (
        <span key={code} className="inline-flex items-center gap-2.5">
          <GameTag code={code ?? ""} />
          {name}
        </span>
      ))}
    </div>
  ),
}
