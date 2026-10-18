import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlugConnected, IconTrash, IconUserOff } from "@tabler/icons-react"
import { fn } from "storybook/test"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"
import { Button } from "./button"

const meta = {
  title: "Components/Alert Dialog",
  component: AlertDialog,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
} satisfies Meta<typeof AlertDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Restart server</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restart Bangkok 24/7 Dust2?</AlertDialogTitle>
          <AlertDialogDescription>
            Connected players will be dropped while the server restarts. It is usually back within
            30 seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Restart</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

export const Open: Story = { ...Default, args: { defaultOpen: true } }

export const DeleteServer: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <IconTrash />
          Delete server
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Bangkok 24/7 Dust2?</AlertDialogTitle>
          <AlertDialogDescription>
            The server, its RCON credentials and 14,302 recorded events will be removed permanently.
            Player stats earned on it are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete server</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

export const WithMedia: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Reconnect RCON</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <IconPlugConnected />
          </AlertDialogMedia>
          <AlertDialogTitle>Reconnect RCON?</AlertDialogTitle>
          <AlertDialogDescription>
            The daemon will drop its session to 203.0.113.42:27015 and open a new one. Scheduled
            commands pause until it reconnects.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Reconnect</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

export const Small: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Kick player
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <IconUserOff />
          </AlertDialogMedia>
          <AlertDialogTitle>Kick tanuki?</AlertDialogTitle>
          <AlertDialogDescription>They can rejoin straight away.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Kick</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
