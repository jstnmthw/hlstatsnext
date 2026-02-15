type LogType = "info" | "warning" | "error" | "success" | "step"

const icons = {
  info: "ℹ",
  warning: "⚠",
  error: "✖",
  success: "✔",
  step: "▸",
}

const colors = {
  info: "\u001b[36m", // Cyan
  warning: "\u001b[33m", // Yellow
  error: "\u001b[31m", // Red
  success: "\u001b[32m", // Green
  step: "\u001b[1m", // Bold
  dim: "\u001b[2m", // Dim
  reset: "\u001b[0m",
}

function logMessage(type: LogType, message: string) {
  const icon = icons[type]
  const color = colors[type]
  console.log(`${color}${icon} ${message}${colors.reset}`)
}

export function log(message: string) {
  console.log(`  ${message}`)
}

export function logInfo(message: string) {
  logMessage("info", message)
}

export function logWarning(message: string) {
  logMessage("warning", message)
}

export function logError(message: string) {
  logMessage("error", message)
}

export function logSuccess(message: string) {
  logMessage("success", message)
}

export function logStep(message: string) {
  console.log(`\n${colors.step}${icons.step} ${message}${colors.reset}`)
}

export function logHeader(title: string) {
  const line = "─".repeat(42)
  console.log(`  ${colors.dim}${line}${colors.reset}`)
  console.log(`  ${colors.step}${title}${colors.reset}`)
  console.log(`  ${colors.dim}${line}${colors.reset}`)
}

export function logDivider() {
  console.log(`\n  ${colors.dim}${"─".repeat(42)}${colors.reset}`)
}
