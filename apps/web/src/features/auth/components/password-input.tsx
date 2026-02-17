"use client"

import {
  IconEye,
  IconEyeOff,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui"
import { useState } from "react"

interface PasswordInputProps extends Omit<React.ComponentProps<typeof InputGroupInput>, "type"> {
  showToggle?: boolean
}

export function PasswordInput({ showToggle, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  if (!showToggle) {
    return <InputGroupInput type="password" {...props} />
  }

  return (
    <InputGroup>
      <InputGroupInput type={visible ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          onClick={() => setVisible(!visible)}
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <IconEye /> : <IconEyeOff />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
