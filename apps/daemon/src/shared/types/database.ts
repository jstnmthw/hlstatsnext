/**
 * Database-related types shared across modules
 */

import type { TransactionalPrisma } from "@/database/client"

export type DatabaseTransaction = TransactionalPrisma

export interface RepositoryOptions {
  transaction?: DatabaseTransaction
}

export interface CreateOptions extends RepositoryOptions {
  validateInput?: boolean
}

export interface UpdateOptions extends RepositoryOptions {
  validateInput?: boolean
  upsert?: boolean
}

export interface FindOptions extends RepositoryOptions {
  include?: Record<string, unknown>
  select?: Record<string, unknown>
}

export interface QueryOptions extends FindOptions {
  limit?: number
  offset?: number
  orderBy?: Record<string, "asc" | "desc">
}
