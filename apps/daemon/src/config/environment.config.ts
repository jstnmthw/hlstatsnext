export interface EnvironmentConfig {
  nodeEnv: string
  ingressOptions: {
    port?: number
  }
  rconConfig: {
    enabled: boolean
    statusInterval: number
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
    },
  }
}
