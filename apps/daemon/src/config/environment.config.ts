export interface EnvironmentConfig {
  nodeEnv: string
  ingressOptions: {
    port?: number
  }
  rconConfig: {
    enabled: boolean
    statusInterval: number
    maxConsecutiveFailures?: number
    backoffMultiplier?: number
    maxBackoffMinutes?: number
    dormantRetryMinutes?: number
  }
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development"

  return {
    nodeEnv,
    ingressOptions: {
      port: process.env.INGRESS_PORT ? parseInt(process.env.INGRESS_PORT, 10) : undefined,
    },
    rconConfig: {
      enabled: process.env.RCON_ENABLED === "true",
      statusInterval: parseInt(process.env.RCON_STATUS_INTERVAL || "30000", 10),
      maxConsecutiveFailures: process.env.RCON_MAX_CONSECUTIVE_FAILURES
        ? parseInt(process.env.RCON_MAX_CONSECUTIVE_FAILURES, 10)
        : undefined,
      backoffMultiplier: process.env.RCON_BACKOFF_MULTIPLIER
        ? parseFloat(process.env.RCON_BACKOFF_MULTIPLIER)
        : undefined,
      maxBackoffMinutes: process.env.RCON_MAX_BACKOFF_MINUTES
        ? parseInt(process.env.RCON_MAX_BACKOFF_MINUTES, 10)
        : undefined,
      dormantRetryMinutes: process.env.RCON_DORMANT_RETRY_MINUTES
        ? parseInt(process.env.RCON_DORMANT_RETRY_MINUTES, 10)
        : undefined,
    },
  }
}
