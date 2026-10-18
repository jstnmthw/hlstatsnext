import type { Meta, StoryObj } from "@storybook/react-vite"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useState, type ComponentProps } from "react"
import { fn } from "storybook/test"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "./input-otp"
import { Label } from "./label"

const sixSlots = (
  <>
    <InputOTPGroup>
      <InputOTPSlot index={0} />
      <InputOTPSlot index={1} />
      <InputOTPSlot index={2} />
    </InputOTPGroup>
    <InputOTPSeparator />
    <InputOTPGroup>
      <InputOTPSlot index={3} />
      <InputOTPSlot index={4} />
      <InputOTPSlot index={5} />
    </InputOTPGroup>
  </>
)

const meta = {
  title: "Components/Input OTP",
  component: InputOTP,
  tags: ["autodocs"],
  args: {
    maxLength: 6,
    pattern: REGEXP_ONLY_DIGITS,
    disabled: false,
    onChange: fn(),
    onComplete: fn(),
    children: sixSlots,
  },
} satisfies Meta<typeof InputOTP>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FourSlots: Story = {
  args: {
    maxLength: 4,
    children: (
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
    ),
  },
}

export const Disabled: Story = { args: { disabled: true } }

export const Invalid: Story = {
  args: {
    defaultValue: "123",
    children: (
      <>
        <InputOTPGroup>
          <InputOTPSlot index={0} aria-invalid />
          <InputOTPSlot index={1} aria-invalid />
          <InputOTPSlot index={2} aria-invalid />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} aria-invalid />
          <InputOTPSlot index={4} aria-invalid />
          <InputOTPSlot index={5} aria-invalid />
        </InputOTPGroup>
      </>
    ),
  },
}

function LinkCodeInput({
  maxLength,
  pattern,
  disabled,
  onChange,
  onComplete,
}: Pick<
  ComponentProps<typeof InputOTP>,
  "maxLength" | "pattern" | "disabled" | "onChange" | "onComplete"
>) {
  const [code, setCode] = useState("")

  return (
    <div className="grid gap-3">
      <Label htmlFor="link-code">Link code</Label>
      <InputOTP
        id="link-code"
        maxLength={maxLength}
        pattern={pattern}
        disabled={disabled}
        value={code}
        onChange={(next) => {
          setCode(next)
          onChange?.(next)
        }}
        onComplete={onComplete}
      >
        {sixSlots}
      </InputOTP>
      <p className="text-sm text-muted-foreground">
        {code.length === maxLength
          ? "Code complete"
          : `Enter the ${maxLength}-digit code the server sent you in chat`}
      </p>
    </div>
  )
}

export const Controlled: Story = {
  render: (args) => (
    <LinkCodeInput
      maxLength={args.maxLength}
      pattern={args.pattern}
      disabled={args.disabled}
      onChange={args.onChange}
      onComplete={args.onComplete}
    />
  ),
}
