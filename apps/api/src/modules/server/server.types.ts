import type { Prisma } from "@repo/db/client"

export interface CreateServerInput {
  address?: string
  port: number
  game: string
  name?: string
  mod?: string
  rconPassword?: string
  publicAddress?: string
  statusUrl?: string
  sortOrder?: number
}

export interface UpdateServerInput {
  name?: string
  address?: string
  port?: number
  game?: string
  mod?: string
  publicAddress?: string
  statusUrl?: string | null
  rconPassword?: string
  sortOrder?: number
}

export interface CreateServerResult {
  server: Prisma.ServerGetPayload<{
    include: {
      configs: true
    }
  }>
  configsCount: number
}

export interface ServerConfigCopyResult {
  defaultConfigs: number
  gameConfigs: number
  modConfigs: number
  totalConfigs: number
}
