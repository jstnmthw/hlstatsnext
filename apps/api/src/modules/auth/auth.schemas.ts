import { z } from "zod"

export const AuthenticateUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(16, "Username must be less than 17 characters long")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  password: z.string().min(1, "Password is required"),
})

export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(16, "Username must be less than 17 characters long")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password must be less than 128 characters long")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
      "Password contains invalid characters",
    ),
  playerId: z.number().optional(),
  acclevel: z.number().min(0).max(100).default(0),
})

export const UpdatePasswordSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(16, "Username must be less than 17 characters long"),
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long")
    .max(128, "New password must be less than 128 characters long")
    .regex(/[a-z]/, "New password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
    .regex(/[0-9]/, "New password must contain at least one number")
    .regex(
      /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
      "New password contains invalid characters",
    ),
})

export const ResetPasswordSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(16, "Username must be less than 17 characters long"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long")
    .max(128, "New password must be less than 128 characters long")
    .regex(/[a-z]/, "New password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
    .regex(/[0-9]/, "New password must contain at least one number")
    .regex(
      /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
      "New password contains invalid characters",
    ),
})

export const CheckAccessSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(16, "Username must be less than 17 characters long"),
  requiredLevel: z.number().min(0).max(100),
})

export type AuthenticateUserInput = z.infer<typeof AuthenticateUserSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type CheckAccessInput = z.infer<typeof CheckAccessSchema>
