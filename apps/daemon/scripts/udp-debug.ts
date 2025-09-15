#!/usr/bin/env tsx
/**
 * UDP Debug Logger
 *
 * Standalone script to monitor raw UDP packets on port 27500
 * Run alongside the daemon to debug connection issues
 *
 * Usage:
 *   pnpm tsx scripts/udp-debug.ts
 *   pnpm tsx scripts/udp-debug.ts --port 27501
 *   pnpm tsx scripts/udp-debug.ts --host 0.0.0.0 --port 27500
 */

import { createSocket } from "dgram"
import { parseArgs } from "util"

// ANSI color codes for pretty output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
}

// Parse command line arguments
const { values } = parseArgs({
  options: {
    port: {
      type: "string",
      short: "p",
      default: "27500",
    },
    host: {
      type: "string",
      short: "h",
      default: "0.0.0.0",
    },
    verbose: {
      type: "boolean",
      short: "v",
      default: false,
    },
  },
})

const port = parseInt(values.port || "27500", 10)
const host = values.host || "0.0.0.0"
const verbose = values.verbose || false

// Statistics
let packetCount = 0
let bytesReceived = 0
const sourceIPs = new Map<string, number>()

// Format timestamp
function timestamp(): string {
  return new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "")
}

// Format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

// Print header
console.log(
  `${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════`,
)
console.log(`  UDP Debug Logger - Monitoring ${host}:${port}`)
console.log(`════════════════════════════════════════════════════════════════${colors.reset}`)
console.log(`${colors.gray}Press Ctrl+C to stop${colors.reset}\n`)

// Create UDP socket
const socket = createSocket("udp4")

// Handle incoming messages
socket.on("message", (buffer, rinfo) => {
  packetCount++
  bytesReceived += buffer.length

  const sourceKey = `${rinfo.address}:${rinfo.port}`
  sourceIPs.set(sourceKey, (sourceIPs.get(sourceKey) || 0) + 1)

  const logLine = buffer.toString("utf8").trim()

  // Print packet header
  console.log(
    `${colors.green}${colors.bright}[${timestamp()}]${colors.reset} ${colors.yellow}Packet #${packetCount}${colors.reset}`,
  )
  console.log(`${colors.blue}  Source:${colors.reset} ${rinfo.address}:${rinfo.port}`)
  console.log(`${colors.blue}  Size:${colors.reset} ${buffer.length} bytes`)

  // Print packet content
  if (logLine) {
    // Check if it looks like a game log
    if (logLine.startsWith("L ")) {
      console.log(`${colors.blue}  Type:${colors.reset} ${colors.green}Game Log${colors.reset}`)

      // Try to extract some useful info
      const dateMatch = logLine.match(/L (\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}):/)
      if (dateMatch) {
        console.log(`${colors.blue}  Game Time:${colors.reset} ${dateMatch[1]}`)
      }

      // Check for player actions
      if (logLine.includes("connected")) {
        console.log(
          `${colors.blue}  Event:${colors.reset} ${colors.green}Player Connected${colors.reset}`,
        )
      } else if (logLine.includes("disconnected")) {
        console.log(
          `${colors.blue}  Event:${colors.reset} ${colors.red}Player Disconnected${colors.reset}`,
        )
      } else if (logLine.includes("killed")) {
        console.log(`${colors.blue}  Event:${colors.reset} ${colors.yellow}Kill${colors.reset}`)
      } else if (logLine.includes("say")) {
        console.log(`${colors.blue}  Event:${colors.reset} ${colors.cyan}Chat${colors.reset}`)
      }
    }

    console.log(`${colors.blue}  Content:${colors.reset}`)
    if (verbose || logLine.length <= 200) {
      console.log(`${colors.gray}  │ ${logLine}${colors.reset}`)
    } else {
      console.log(`${colors.gray}  │ ${logLine.substring(0, 200)}...${colors.reset}`)
      console.log(`${colors.gray}  │ (${logLine.length - 200} more characters)${colors.reset}`)
    }
  } else {
    console.log(`${colors.blue}  Content:${colors.reset} ${colors.gray}(empty)${colors.reset}`)
  }

  // Print hex dump for non-text content
  if (verbose && buffer.length < 256) {
    console.log(`${colors.blue}  Hex:${colors.reset}`)
    const hex =
      buffer
        .toString("hex")
        .match(/.{1,2}/g)
        ?.join(" ") || ""
    const hexLines = hex.match(/.{1,48}/g) || []
    hexLines.forEach((line) => {
      console.log(`${colors.gray}  │ ${line}${colors.reset}`)
    })
  }

  console.log(
    `${colors.gray}────────────────────────────────────────────────────────────────${colors.reset}`,
  )
})

// Handle errors
socket.on("error", (err) => {
  console.error(`${colors.red}${colors.bright}[ERROR]${colors.reset} ${err.message}`)
  if (err.message.includes("EADDRINUSE")) {
    console.error(
      `${colors.yellow}Port ${port} is already in use. Is the daemon running?${colors.reset}`,
    )
    console.error(`${colors.yellow}Try running with a different port: --port 27501${colors.reset}`)
  }
})

// Bind to port
socket.bind(port, host, () => {
  console.log(
    `${colors.green}${colors.bright}[READY]${colors.reset} UDP socket listening on ${host}:${port}`,
  )
  console.log(`${colors.gray}Waiting for packets...${colors.reset}\n`)
})

// Handle shutdown
process.on("SIGINT", () => {
  console.log(
    `\n${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════`,
  )
  console.log(`  Session Statistics`)
  console.log(`════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}  Total Packets:${colors.reset} ${packetCount}`)
  console.log(`${colors.blue}  Total Data:${colors.reset} ${formatBytes(bytesReceived)}`)
  console.log(`${colors.blue}  Unique Sources:${colors.reset} ${sourceIPs.size}`)

  if (sourceIPs.size > 0) {
    console.log(`\n${colors.blue}  Source Breakdown:${colors.reset}`)
    const sorted = Array.from(sourceIPs.entries()).sort((a, b) => b[1] - a[1])
    sorted.slice(0, 10).forEach(([ip, count]) => {
      console.log(`    ${ip}: ${count} packets`)
    })
    if (sorted.length > 10) {
      console.log(`    ... and ${sorted.length - 10} more sources`)
    }
  }

  console.log(
    `${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════${colors.reset}`,
  )
  process.exit(0)
})

// Keep the script running
process.stdin.resume()
