"use client"

import { useActionState } from "react"
import { createServer } from "@/features/admin/servers/actions/create-server"
import { FormField, ErrorMessage, ErrorDisplay } from "@/features/common/components/form"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  IPAddress,
  Port,
} from "@repo/ui"

export function ServerCreateForm() {
  const [state, formAction, pending] = useActionState(createServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <div className="grid md:grid-cols-2 gap-4">
        <FormField>
          <Label htmlFor="game" required>
            Game Type
          </Label>
          <Select name="game" defaultValue="cstrike">
            <SelectTrigger id="game" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cstrike">Counter-Strike</SelectItem>
              <SelectItem value="css">Counter-Strike: Source</SelectItem>
              <SelectItem value="tf">Team Fortress Classic</SelectItem>
              <SelectItem value="dod">Day of Defeat</SelectItem>
              <SelectItem value="hl">Half-Life</SelectItem>
            </SelectContent>
          </Select>
          {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <div className="flex">
            <IPAddress
              className="rounded-r-none"
              name="address"
              required
              placeholder="192.168.1.1"
              title="Enter a valid IP address (e.g., 192.168.1.1)"
            />
            <Port
              className="rounded-l-none -ml-px border-l-transparent max-w-18"
              name="port"
              required
              placeholder="27015"
              title="Enter a port number (1-65535)"
            />
          </div>
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
          {state.errors?.port && <ErrorMessage>{state.errors.port[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid md:grid-cols-1">
        <FormField>
          <Label htmlFor="rconPassword">RCON Password</Label>
          <Input
            id="rconPassword"
            name="rconPassword"
            type="password"
            placeholder="Optional remote console password"
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Used for remote server administration and real-time monitoring.
          </p>
          {state.errors?.rconPassword && (
            <ErrorMessage>{state.errors.rconPassword[0]}</ErrorMessage>
          )}
        </FormField>
      </div>

      <div className="flex gap-4 pt-6">
        <Button
          type="submit"
          disabled={pending}
          variant="solid"
          colorScheme="green"
          className="w-full"
        >
          {pending ? "Adding Server..." : "Submit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
