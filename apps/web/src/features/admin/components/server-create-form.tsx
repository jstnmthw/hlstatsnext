"use client"

import { useActionState } from "react"
import { createServer } from "@/features/admin/actions/create-server"
import { FormField, ErrorMessage, ErrorDisplay } from "@/features/admin/components/form"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from "@repo/ui"

export function ServerCreateForm() {
  const [state, formAction, pending] = useActionState(createServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <div className="grid md:grid-cols-1">
        <FormField>
          <Label htmlFor="game">Game Type</Label>
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
      </div>

      <div className="grid grid-cols-5">
        <FormField className="col-span-3">
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <Input
            id="address"
            name="address"
            placeholder="192.168.1.100"
            required
            maxLength={255}
            className="rounded-r-none"
          />
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
        </FormField>

        <FormField className="col-span-2">
          <Label htmlFor="port" required>
            Port
          </Label>
          <Input
            id="port"
            name="port"
            type="text"
            placeholder="27015"
            min={1}
            max={65535}
            required
            className="rounded-l-none -ml-px border-l-transparent"
          />
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
