import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAward, IconChartBar, IconHistory } from "@tabler/icons-react"
import { Badge } from "./badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { defaultValue: "overview", className: "w-2xl" },
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="weapons">Weapons</TabsTrigger>
        <TabsTrigger value="awards">Awards</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Rank, skill and streaks for this player.</TabsContent>
      <TabsContent value="sessions">Skill change per session.</TabsContent>
      <TabsContent value="weapons">Share of kills by weapon, all time.</TabsContent>
      <TabsContent value="awards">9 of 24 unlocked.</TabsContent>
    </Tabs>
  ),
}

export const WithIcons: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="overview">
          <IconChartBar />
          Overview
        </TabsTrigger>
        <TabsTrigger value="sessions">
          <IconHistory />
          Sessions
        </TabsTrigger>
        <TabsTrigger value="awards">
          <IconAward />
          Awards
          <Badge variant="secondary">9</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Rank, skill and streaks for this player.</TabsContent>
      <TabsContent value="sessions">Skill change per session.</TabsContent>
      <TabsContent value="awards">9 of 24 unlocked.</TabsContent>
    </Tabs>
  ),
}

export const Disabled: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="sessions" disabled>
          Sessions
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Sessions unlock after you claim the player.</TabsContent>
    </Tabs>
  ),
}
