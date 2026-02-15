/**
 * Mail adapter system for sending OTP emails.
 *
 * Controlled by MAIL_PROVIDER env var:
 *   - "console" (default): Logs OTP to stdout (development)
 *   - "resend": Sends via Resend API (production)
 *
 * Environment variables:
 *   - MAIL_PROVIDER: "console" | "resend"
 *   - RESEND_API_KEY: Required when MAIL_PROVIDER=resend
 *   - MAIL_FROM: Sender address (default: "noreply@hlstatsnext.com")
 */

interface SendOTPParams {
  email: string
  otp: string
  type: "sign-in" | "email-verification" | "forget-password"
}

const subjectMap = {
  "sign-in": "Your sign-in code",
  "email-verification": "Verify your email address",
  "forget-password": "Reset your password",
} as const

function getBody(otp: string, type: SendOTPParams["type"]): string {
  switch (type) {
    case "email-verification":
      return `Your email verification code is: ${otp}\n\nThis code expires in 5 minutes.`
    case "forget-password":
      return `Your password reset code is: ${otp}\n\nThis code expires in 5 minutes. If you did not request this, please ignore this email.`
    case "sign-in":
      return `Your sign-in code is: ${otp}\n\nThis code expires in 5 minutes.`
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
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("[MAIL] RESEND_API_KEY is not set — falling back to console")
    return sendViaConsole({ email, otp, type })
  }

  const { Resend } = await import("resend")
  const resend = new Resend(apiKey)
  const from = process.env.MAIL_FROM ?? "noreply@hlstatsnext.com"

  const { error } = await resend.emails.send({
    from,
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
  const provider = process.env.MAIL_PROVIDER ?? "console"

  switch (provider) {
    case "resend":
      return sendViaResend(params)
    case "console":
    default:
      return sendViaConsole(params)
  }
}
