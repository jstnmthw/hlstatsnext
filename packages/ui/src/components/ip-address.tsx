"use client"

import { Input } from "./input"
import { useState } from "react"

export function IPAddress() {
  const [ip, setIp] = useState("")
  const [port, setPort] = useState("")

  const handleIPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatIPAddress(value)
    setIp(formatted)
  }

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "") // Only allow digits
    const numValue = Number.parseInt(value, 10)

    // Limit port to valid range (1-65535)
    if (value === "" || (numValue >= 1 && numValue <= 65535)) {
      setPort(value)
    }
  }

  const formatIPAddress = (value: string) => {
    // Remove all non-numeric characters except dots
    const cleaned = value.replace(/[^\d.]/g, "")

    // Split by dots and process each octet
    const parts = cleaned.split(".")
    const formattedParts: string[] = []

    for (let i = 0; i < Math.min(parts.length, 4); i++) {
      let part = parts[i]

      // Limit each octet to 3 digits and max value of 255
      if (part && part.length > 3) {
        part = part.slice(0, 3)
      } else if (!part) {
        part = "0"
      }

      const numValue = Number.parseInt(part, 10)
      if (!isNaN(numValue) && numValue > 255) {
        part = "255"
      }

      formattedParts.push(part)
    }

    // Join with dots, but don't add trailing dot
    let formatted = formattedParts.join(".")

    // Add dots automatically as user types
    if (cleaned.length > 0 && !cleaned.endsWith(".") && formattedParts.length < 4) {
      const lastPart = formattedParts[formattedParts.length - 1]
      if (
        lastPart &&
        (lastPart.length === 3 || (lastPart.length > 0 && Number.parseInt(lastPart, 10) > 25))
      ) {
        formatted += "."
      }
    }

    return formatted
  }

  return (
    <div className="flex">
      <Input
        id="ip-address"
        type="text"
        value={ip}
        onChange={handleIPChange}
        placeholder="192.168.1.1"
        maxLength={15}
        className="font-mono rounded-r-none border-r-0 flex-1"
      />
      <Input
        id="port"
        type="text"
        value={port}
        onChange={handlePortChange}
        placeholder="8080"
        maxLength={5}
        className="font-mono rounded-l-none w-24"
      />
    </div>
  )
}
