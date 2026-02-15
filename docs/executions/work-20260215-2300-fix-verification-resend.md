# Next.js v16 Work Log — fix-verification-resend

## Request

Fix P2002 unique constraint violation when clicking "resend code" on reset password page. Add cooldown timer to prevent rapid re-clicking, and ensure backend rate limiting covers the endpoint.

## Context captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts: `/reset-password`, `/verify-email`
- Error: `PrismaClientKnownRequestError` P2002 on `verification_identifier_key`

## Root cause

Better Auth's `requestPasswordResetEmailOTP` endpoint (`/email-otp/request-password-reset`) does NOT clean up existing verification records before creating new ones. The `sendVerificationOTP` endpoint has a catch-and-retry pattern (catch P2002, delete old record, retry create), but the password reset endpoint lacks it.

The `verification.identifier` field has a `@unique` constraint (required for Better Auth's delete operations), so the second `create()` call for the same email fails with P2002.

## Changes made

### 1. Backend — Prisma client extension (packages/auth/src/server.ts)

Added a `$extends` query extension on the Prisma client passed to Better Auth's prisma adapter. When `verification.create()` throws P2002, it deletes the existing record by identifier and retries — matching what `sendVerificationOTP` does internally.

### 2. Backend — Rate limit for email OTP password reset (packages/auth/src/server.ts)

Added rate limit rule for `/email-otp/request-password-reset` (3 req/60s). This endpoint was NOT covered by the existing `/forget-password/*` rule since it's under the `/email-otp/` path.

### 3. Frontend — Reset password form (apps/web/src/features/auth/components/reset-password-form.tsx)

- 60-second countdown timer starting on mount (code was just sent)
- Resend button disabled during cooldown, shows "Resend code in Xs"
- Timer resets after each resend
- Success/error feedback on resend attempts

### 4. Frontend — Verify email form (apps/web/src/features/auth/components/verify-email-form.tsx)

- Same 60-second countdown pattern for consistency
- Resend button disabled during cooldown
- Timer resets after each resend

### Files touched

- `packages/auth/src/server.ts`
- `apps/web/src/features/auth/components/reset-password-form.tsx`
- `apps/web/src/features/auth/components/verify-email-form.tsx`

## Rationale

- Prisma `$extends` query extension is the recommended approach for intercepting operations in Prisma v7 (replaces deprecated `$use` middleware)
- 60-second frontend cooldown aligns with the backend rate limit window (60s / 3 max)
- Backend rate limiting is the authoritative protection; frontend cooldown is UX improvement only

## Verification

- `pnpm --filter @repo/auth run check-types` — pass
- `pnpm --filter web run check-types` — pass
- `pnpm --filter @repo/auth run lint` — pass (0 errors, 3 pre-existing env warnings)
- `pnpm --filter web run lint` — pass (0 errors, 0 warnings)

## Follow-ups

- Consider upgrading better-auth if a future version fixes the missing catch-and-retry in `requestPasswordResetEmailOTP`
- The `@unique` constraint on `verification.identifier` was added for better-auth#6354 — if Better Auth changes its internal delete strategy, this may need revisiting
