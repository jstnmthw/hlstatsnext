import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { Button } from "./button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  args: { className: "w-80" },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Server status</CardTitle>
        <CardDescription>de_dust2 · 14/32 players</CardDescription>
        <CardAction>
          <Badge variant="solid" colorScheme="green">
            Online
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-muted-foreground">Kills</dt>
          <dd className="text-right font-semibold">1,284</dd>
          <dt className="text-muted-foreground">Deaths</dt>
          <dd className="text-right font-semibold">973</dd>
          <dt className="text-muted-foreground">Uptime</dt>
          <dd className="text-right font-semibold">99.2%</dd>
        </dl>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="secondary" size="sm">
          Details
        </Button>
        <Button size="sm">Join</Button>
      </CardFooter>
    </Card>
  ),
}

export const HeaderOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Top players</CardTitle>
        <CardDescription>Ranked by skill over the last 30 days</CardDescription>
      </CardHeader>
    </Card>
  ),
}
