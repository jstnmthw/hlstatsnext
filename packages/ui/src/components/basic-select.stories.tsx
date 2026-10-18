import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { BasicSelect } from "./basic-select"
import { Label } from "./label"

const meta = {
  title: "Components/Basic Select",
  component: BasicSelect,
  tags: ["autodocs"],
  args: { placeholder: "Select a game", defaultValue: "", disabled: false, onChange: fn() },
  render: (args) => (
    <BasicSelect {...args}>
      <option value="cstrike">Counter-Strike 1.6</option>
      <option value="valve">Half-Life Deathmatch</option>
      <option value="tfc">Team Fortress Classic</option>
    </BasicSelect>
  ),
} satisfies Meta<typeof BasicSelect>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValue: Story = { args: { defaultValue: "cstrike" } }

export const Disabled: Story = { args: { disabled: true, defaultValue: "cstrike" } }

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor="game">Game</Label>
      <BasicSelect id="game" {...args}>
        <option value="cstrike">Counter-Strike 1.6</option>
        <option value="valve">Half-Life Deathmatch</option>
        <option value="tfc">Team Fortress Classic</option>
      </BasicSelect>
    </div>
  ),
}

export const WithOptionGroups: Story = {
  args: { placeholder: "Select a server" },
  render: (args) => (
    <BasicSelect {...args}>
      <optgroup label="Counter-Strike 1.6">
        <option value="bangkok">Bangkok 24/7 Dust2</option>
      </optgroup>
      <optgroup label="Half-Life Deathmatch">
        <option value="deathmatch">Deathmatch Arena</option>
        <option value="crossfire">Crossfire Rotation</option>
      </optgroup>
    </BasicSelect>
  ),
}
