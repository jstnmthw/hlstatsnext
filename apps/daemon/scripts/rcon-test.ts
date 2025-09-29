#!/usr/bin/env tsx
/**
 * RCON Connection Test Script
 *
 * Standalone script to test RCON connection to a game server
 *
 * Usage:
 *   pnpm tsx scripts/rcon-test.ts --host 192.168.0.178 --port 27015 --password yourpassword
 *   pnpm tsx scripts/rcon-test.ts --host 192.168.0.178 --port 27015 --password yourpassword --command "status"
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
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}

// Parse command line arguments
const { values } = parseArgs({
  options: {
    host: {
      type: "string",
      short: "h",
      default: "127.0.0.1",
    },
    port: {
      type: "string",
      short: "p",
      default: "27015",
    },
    password: {
      type: "string",
      short: "P",
    },
    command: {
      type: "string",
      short: "c",
      default: "status",
    },
    timeout: {
      type: "string",
      short: "t",
      default: "5000",
    },
  },
})

const host = values.host || "127.0.0.1"
const port = parseInt(values.port || "27015", 10)
const password = values.password
const command = values.command || "status"
const timeout = parseInt(values.timeout || "5000", 10)

if (!password) {
  console.error(`${colors.red}Error: Password is required${colors.reset}`)
  console.log(
    `Usage: pnpm tsx scripts/rcon-test.ts --host <ip> --port <port> --password <password>`,
  )
  process.exit(1)
}

console.log(
  `${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════`,
)
console.log(`  RCON Connection Test`)
console.log(`════════════════════════════════════════════════════════════════${colors.reset}`)
console.log(`${colors.blue}Server:${colors.reset} ${host}:${port}`)
console.log(`${colors.blue}Command:${colors.reset} ${command}`)
console.log(`${colors.blue}Timeout:${colors.reset} ${timeout}ms\n`)

// Create UDP socket for GoldSource RCON
const socket = createSocket("udp4")
let challenge: string | null = null

// Helper to send data
function sendData(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(data, port, host, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

// Step 1: Get challenge
async function getChallenge(): Promise<string> {
  return new Promise((resolve, reject) => {
    const challengeRequest = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from("challenge rcon\n"),
    ])

    console.log(`${colors.yellow}[1/3] Requesting challenge...${colors.reset}`)
    console.log(`${colors.gray}  →  Sending: challenge rcon${colors.reset}`)

    const timer = setTimeout(() => {
      socket.removeAllListeners("message")
      reject(new Error(`Challenge request timeout after ${timeout}ms`))
    }, timeout)

    socket.once("message", (msg) => {
      clearTimeout(timer)
      const response = msg.toString()
      console.log(`${colors.gray}  ← Received: ${response.trim()}${colors.reset}`)

      const challengeMatch = response.match(/challenge rcon (\d+)/)
      if (challengeMatch && challengeMatch[1]) {
        console.log(`${colors.green}  ✓ Challenge received: ${challengeMatch[1]}${colors.reset}\n`)
        resolve(challengeMatch[1])
      } else {
        reject(new Error(`Invalid challenge response: ${response}`))
      }
    })

    sendData(challengeRequest).catch((error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

// Step 2: Send RCON command
async function sendRconCommand(challenge: string, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const commandBuffer = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from(`rcon ${challenge} ${password} ${cmd}\n`),
    ])

    console.log(`${colors.yellow}[2/3] Sending RCON command...${colors.reset}`)
    console.log(`${colors.gray}  →  Command: ${cmd}${colors.reset}`)

    const timer = setTimeout(() => {
      socket.removeAllListeners("message")
      reject(new Error(`Command timeout after ${timeout}ms`))
    }, timeout)

    const fragments: Buffer[] = []

    const onMessage = (msg: Buffer) => {
      // Check if this is a fragmented response
      if (msg.readInt32LE(0) === -1 && msg.readInt32LE(4) === -2) {
        // This is a fragmented response
        const fragmentData = msg.slice(12)
        fragments.push(fragmentData)

        // Check if this is the last fragment
        if (msg[8] === 0x00) {
          clearTimeout(timer)
          socket.removeAllListeners("message")
          const fullResponse = Buffer.concat(fragments).toString()
          console.log(
            `${colors.green}  ✓ Received fragmented response (${fragments.length} fragments)${colors.reset}\n`,
          )
          resolve(fullResponse)
        }
      } else {
        // Non-fragmented response
        clearTimeout(timer)
        socket.removeAllListeners("message")

        // Remove the header (4 bytes of 0xff)
        const responseText = msg.slice(4).toString()

        // Check for authentication failure
        if (responseText.includes("Bad rcon_password")) {
          reject(new Error("Authentication failed: Bad rcon_password"))
        } else {
          console.log(`${colors.green}  ✓ Received response${colors.reset}\n`)
          resolve(responseText)
        }
      }
    }

    socket.on("message", onMessage)

    sendData(commandBuffer).catch((error) => {
      clearTimeout(timer)
      socket.removeAllListeners("message")
      reject(error)
    })
  })
}

// Main execution
async function main() {
  try {
    // Bind socket to any available port
    await new Promise<void>((resolve) => {
      socket.bind(0, () => {
        const address = socket.address()
        console.log(
          `${colors.gray}Local socket bound to ${address.address}:${address.port}${colors.reset}\n`,
        )
        resolve()
      })
    })

    // Get challenge
    challenge = await getChallenge()

    // Send command
    const response = await sendRconCommand(challenge, command)

    // Display response
    console.log(`${colors.yellow}[3/3] Command Response:${colors.reset}`)
    console.log(
      `${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`,
    )
    console.log(response.trim())
    console.log(
      `${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`,
    )

    console.log(`\n${colors.green}${colors.bright}✓ RCON test successful!${colors.reset}`)
    process.exit(0)
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ RCON test failed:${colors.reset}`)
    console.error(`${colors.red}  ${error}${colors.reset}`)

    // Provide helpful suggestions
    console.log(`\n${colors.yellow}Troubleshooting tips:${colors.reset}`)
    console.log(`  1. Check if the server is running and accessible`)
    console.log(`  2. Verify the RCON port (often different from game port)`)
    console.log(`     - CS 1.6 default: game port -1 (e.g., 27016 →  27015 for RCON)`)
    console.log(`  3. Confirm the RCON password is correct`)
    console.log(`  4. Check server.cfg for rcon_password setting`)
    console.log(`  5. Try connecting to the game server first to verify connectivity`)

    process.exit(1)
  } finally {
    socket.close()
  }
}

// Handle errors
socket.on("error", (err) => {
  console.error(`${colors.red}Socket error: ${err.message}${colors.reset}`)
})

// Run the test
main().catch((error) => {
  console.error(`${colors.red}Unexpected error: ${error}${colors.reset}`)
  process.exit(1)
})
