import { z } from "zod"

export const AuthenticateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const CheckRoleSchema = z.object({
  email: z.string().email("Invalid email address"),
  requiredRole: z.string(),
})

export type AuthenticateUserInput = z.infer<typeof AuthenticateUserSchema>
export type CheckRoleInput = z.infer<typeof CheckRoleSchema>
