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
 * Predefined scheduled commands for common server management tasks.
 *
 * All message commands use the AMX plugin's HUD system:
 *   "hlx_csay"    → Center HUD message (color required)
 *   "hlx_tsay"    → Top HUD message (color required)
 *   "hlx_typehud" → Typewriter HUD message (color required)
 */
const defaultScheduledCommands: ScheduledCommand[] = [
  {
    id: "server-rules-reminder",
    name: "Server Rules Reminder",
    cronExpression: "0 */10 * * * *",
    command: {
      type: "hlx_typehud",
      color: "00FF80",
      message: "Type !help for a list of commands",
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
    cronExpression: "0 */15 * * * *",
    command: {
      type: "hlx_typehud",
      color: "ffbf00",
      message: "This server is running HLStatsNext - Visit hlstatsnext.com",
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
    id: "map-vote-reminder",
    name: "Map Vote Reminder",
    cronExpression: "0 40 * * * *",
    command: {
      type: "hlx_typehud",
      color: "8000ff",
      message: "Don't forget to vote for the next map! Type !votemap",
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
    cronExpression: "0 */25 * * * *",
    command: {
      type: "hlx_tsay",
      color: "00FF80",
      message: "Your stats are tracked! Visit hlstatsnext.com to view your progress",
    },
    enabled: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      minPlayers: 5,
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
    cronExpression: "0 0 18-23 * * *",
    command: {
      type: "hlx_typehud",
      color: "FFFF00",
      message: "Welcome to peak hours! Have fun and play fair!",
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
    cronExpression: "0 */45 * * * *",
    command: {
      type: "hlx_tsay",
      color: "FF4444",
      message: "Remember: Excessive camping may result in penalties",
    },
    enabled: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...DEFAULT_RETRY_SETTINGS,
    serverFilter: {
      gameTypes: ["cs", "cs_source"],
      minPlayers: 8,
    },
    metadata: {
      category: "moderation",
      priority: "normal",
      description: "Reminds players about camping rules",
    },
  },

  {
    id: "server-monitoring",
    name: "Server Status Monitoring",
    cronExpression: "*/30 * * * * *",
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
      internal: true,
      realTime: true,
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
  historyRetentionHours: 24 * 7,
  maxConcurrentPerServer: 3,
  schedules: defaultScheduledCommands,
}

/**
 * Schedule configuration by environment
 */
export const getScheduleConfig = (): ScheduleConfig => {
  return { ...defaultScheduleConfig }
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
