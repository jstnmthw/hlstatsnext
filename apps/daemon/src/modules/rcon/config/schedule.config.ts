/**
 * RCON Schedule Configuration
 *
 * Defines default scheduled commands and scheduler settings.
 * This will eventually be moved to database configuration with a web UI.
 */

import type { ScheduleConfig, ScheduledCommand } from "../types/schedule.types"

/**
 * Default timeout for command execution (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30 * 1000

/**
 * Default retry settings
 */
const DEFAULT_RETRY_SETTINGS = {
  retryOnFailure: true,
  maxRetries: 3,
}

/**
 * Predefined scheduled commands for common server management tasks
 */
const defaultScheduledCommands: ScheduledCommand[] = [
  {
    id: "server-rules-reminder",
    name: "Server Rules Reminder",
    cronExpression: "0 */30 * * * *", // Every 30 minutes
    command: {
      type: "server-message",
      message: 'say "Type !help for a list of commands"',
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    metadata: {
      category: "announcement",
      priority: "normal",
      description: "Reminds players about server commands",
    },
  },

  {
    id: "hlstatsnext-promotion",
    name: "HLStatsNext Promotion",
    cronExpression: "0 */10 * * * *", // Every 10 minutes
    command: {
      type: "server-message",
      message: "hlx_csay 80ff00 This server is running HLStatsNext Visit hlstatsnext.com",
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    metadata: {
      category: "announcement",
      priority: "normal",
      description: "Promotes HLStatsNext",
    },
  },

  {
    id: "discord-promotion",
    name: "Discord Server Promotion",
    cronExpression: "0 */15 * * * *",
    command: {
      type: "server-message",
      message: "hlx_csay 00FF00 Join our Discord community! Link: discord.gg/0x1clan",
    },
    enabled: true, // Disabled by default - servers can customize and enable
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      minPlayers: 0,
    },
    metadata: {
      category: "promotion",
      priority: "low",
      description: "Promotes Discord community",
      customizable: true, // Indicates this should be customized per server
    },
  },

  {
    id: "map-vote-reminder",
    name: "Map Vote Reminder",
    cronExpression: "0 50 * * * *", // 10 minutes before each hour
    command: {
      type: "server-message",
      message: "hlx_typehud 8000ff Don't forget to vote for the next map! Type !votemap",
    },
    enabled: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      minPlayers: 4,
    },
    metadata: {
      category: "gameplay",
      priority: "normal",
      description: "Reminds players to vote for maps",
    },
  },

  {
    id: "stats-announcement",
    name: "Stats Information",
    cronExpression: "0 15 * * * *", // Every hour at 15 minutes past
    command: {
      type: "server-message",
      message: 'say "Your stats are tracked! Visit hlstatsnext.com to view your progress"',
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      minPlayers: 5, // Only announce when there are at least 5 players
    },
    metadata: {
      category: "announcement",
      priority: "low",
      description: "Promotes the stats website",
    },
  },

  {
    id: "peak-hours-welcome",
    name: "Peak Hours Welcome Message",
    cronExpression: "0 0 18-23 * * *", // Every hour from 6 PM to 11 PM
    command: {
      type: "server-message",
      message: 'say "Welcome to peak hours! Have fun and play fair!"',
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      minPlayers: 3,
    },
    metadata: {
      category: "announcement",
      priority: "normal",
      description: "Welcome message during peak gaming hours",
    },
  },

  {
    id: "anti-camp-reminder",
    name: "Anti-Camping Reminder",
    cronExpression: "0 */45 * * * *", // Every 45 minutes
    command: {
      type: "server-message",
      message: 'say "Remember: Excessive camping may result in penalties"',
    },
    enabled: false, // Disabled by default, can be enabled per server
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      gameTypes: ["cs", "cs_source"], // Only for Counter-Strike games
      minPlayers: 8,
    },
    metadata: {
      category: "moderation",
      priority: "normal",
      description: "Reminds players about camping rules",
    },
  },

  {
    id: "server-restart-warning",
    name: "Server Restart Warning",
    cronExpression: "0 55 3 * * *", // Daily at 3:55 AM (5 minutes before restart)
    command: {
      type: "server-message",
      message: 'say "Server restart in 5 minutes! Current round will finish normally."',
    },
    enabled: false, // Only enable on servers that have scheduled restarts
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retryOnFailure: false, // Don't retry restart warnings
    maxRetries: 0,
    metadata: {
      category: "maintenance",
      priority: "critical",
      description: "Warns players about scheduled server restart",
    },
  },

  {
    id: "server-monitoring",
    name: "Server Status Monitoring",
    cronExpression: "*/30 * * * * *", // Every 30 seconds for real-time data
    command: {
      type: "server-monitoring",
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retryOnFailure: true,
    maxRetries: 2,
    metadata: {
      category: "monitoring",
      priority: "critical",
      description: "Real-time server status monitoring and RCON health checks",
      captureStats: true,
      internal: true, // Not visible to players
      realTime: true, // Indicates this is for real-time monitoring
    },
  },
]

/**
 * Default scheduler configuration
 */
export const defaultScheduleConfig: ScheduleConfig = {
  enabled: true,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultRetryOnFailure: true,
  defaultMaxRetries: 3,
  historyRetentionHours: 24 * 7, // Keep 7 days of history
  maxConcurrentPerServer: 3, // Max 3 concurrent scheduled commands per server
  schedules: defaultScheduledCommands,
}

/**
 * Schedule configuration by environment
 */
export const getScheduleConfig = (environment: string = "production"): ScheduleConfig => {
  const config = { ...defaultScheduleConfig }

  switch (environment) {
    case "development":
      // In development, reduce frequency and enable more verbose schedules
      config.schedules = config.schedules.map((schedule) => ({
        ...schedule,
        // Convert all schedules to run more frequently for testing
        cronExpression: schedule.cronExpression.includes("*/30")
          ? "0 */2 * * * *" // Every 2 minutes instead of 30
          : schedule.cronExpression.includes("*/45")
            ? "0 */3 * * * *" // Every 3 minutes instead of 45
            : schedule.cronExpression,
        enabled: schedule.metadata?.category === "monitoring" ? true : schedule.enabled,
      }))
      break

    case "staging":
      // In staging, enable most schedules but with reduced frequency
      config.schedules = config.schedules.map((schedule) => ({
        ...schedule,
        enabled: schedule.metadata?.category !== "promotion", // Disable promotional messages
      }))
      break

    case "production":
    default:
      // Production uses default configuration
      break
  }

  return config
}

/**
 * Get schedules by category
 */
export const getSchedulesByCategory = (
  category: string,
  config: ScheduleConfig = defaultScheduleConfig,
): ScheduledCommand[] => {
  return config.schedules.filter((schedule) => schedule.metadata?.category === category)
}

/**
 * Get enabled schedules only
 */
export const getEnabledSchedules = (
  config: ScheduleConfig = defaultScheduleConfig,
): ScheduledCommand[] => {
  return config.schedules.filter((schedule) => schedule.enabled)
}

/**
 * Validate a cron expression
 */
export const isValidCronExpression = (expression: string): boolean => {
  // Basic validation for cron expressions
  // node-cron supports both 5-field and 6-field (with seconds) expressions
  const parts = expression.trim().split(/\s+/)
  return parts.length === 5 || parts.length === 6
}

/**
 * Schedule categories for organization
 */
export const SCHEDULE_CATEGORIES = {
  ANNOUNCEMENT: "announcement",
  MONITORING: "monitoring",
  MODERATION: "moderation",
  MAINTENANCE: "maintenance",
  PROMOTION: "promotion",
  GAMEPLAY: "gameplay",
} as const

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[keyof typeof SCHEDULE_CATEGORIES]
