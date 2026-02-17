# Next.js v16 Work Log — replace-otp-with-shadcn-input-otp

## Request

Replace the plain `<Input>` OTP text fields on the verify-email and reset-password forms with shadcn's `InputOTP` component (individual digit slots with separator).

## Context captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts: `(auth)/verify-email`, `(auth)/reset-password`

## Changes made

- Installed shadcn `input-otp` component into `packages/ui` (adds `input-otp` npm dependency)
- Replaced `MinusIcon` from `lucide-react` (not used in project) with a plain `-` text separator
- Exported `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` from `packages/ui`
- Replaced `<Input>` OTP fields in both forms with `<InputOTP>` using 3+3 slot layout with separator

### Files touched

- `packages/ui/src/components/input-otp.tsx` (new — installed via shadcn CLI, patched lucide dep)
- `packages/ui/src/index.ts` (added InputOTP exports)
- `apps/web/src/features/auth/components/verify-email-form.tsx` (swapped Input → InputOTP)
- `apps/web/src/features/auth/components/reset-password-form.tsx` (swapped Input → InputOTP)

## Rationale

- shadcn `InputOTP` provides per-digit slots, caret animation, and accessible keyboard navigation out of the box, replacing a manually styled single `<Input>` field.
- The `onChange` callback directly provides the string value, simplifying state management (no need for `e.target.value.replace(/\D/g, "")`).

## Verification

- `pnpm --filter web run check-types` — passes clean (0 errors)

## Follow-ups

- Visually verify the OTP input renders correctly in both forms (themed slots, separator)
- Consider auto-submit when all 6 digits are entered (`onComplete` callback)
