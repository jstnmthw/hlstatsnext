/**
 * Mail adapter system for sending OTP emails.
 *
 * Controlled by MAIL_PROVIDER (validated in ./env):
 *   - "console" (default): Logs OTP to stdout (development)
 *   - "resend": Sends via Resend API (production); RESEND_API_KEY is required,
 *     MAIL_FROM is the sender address
 */

import { getEnv } from "./env"

interface SendOTPParams {
  email: string
  otp: string
  type: "sign-in" | "email-verification" | "forget-password" | "change-email"
}

const subjectMap = {
  "sign-in": "Your sign-in code",
  "email-verification": "Verify your email address",
  "forget-password": "Reset your password",
  "change-email": "Confirm your new email address",
} as const

function getBody(otp: string, type: SendOTPParams["type"]): string {
  switch (type) {
    case "email-verification":
      return `Your email verification code is: ${otp}\n\nThis code expires in 5 minutes.`
    case "forget-password":
      return `Your password reset code is: ${otp}\n\nThis code expires in 5 minutes. If you did not request this, please ignore this email.`
    case "sign-in":
      return `Your sign-in code is: ${otp}\n\nThis code expires in 5 minutes.`
    case "change-email":
      return `Your email change confirmation code is: ${otp}\n\nThis code expires in 5 minutes. If you did not request this, please ignore this email.`
  }
}

async function sendViaConsole({ email, otp, type }: SendOTPParams): Promise<void> {
  const divider = "=".repeat(50)
  console.log(divider)
  console.log(`[MAIL] OTP for ${type}`)
  console.log(`  To:   ${email}`)
  console.log(`  Code: ${otp}`)
  console.log(divider)
}

async function sendViaResend({ email, otp, type }: SendOTPParams): Promise<void> {
  const env = getEnv()
  const { Resend } = await import("resend")
  const resend = new Resend(env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to: email,
    subject: subjectMap[type],
    text: getBody(otp, type),
  })

  if (error) {
    console.error("[MAIL] Resend error:", error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export async function sendOTP(params: SendOTPParams): Promise<void> {
  switch (getEnv().MAIL_PROVIDER) {
    case "resend":
      return sendViaResend(params)
    case "console":
      return sendViaConsole(params)
  }
}
