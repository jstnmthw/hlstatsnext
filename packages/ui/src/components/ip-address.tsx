"use client"

import { Input } from "./input"
import { cn } from "../lib/utils"
import { useState, useRef, useEffect } from "react"

interface IPAddressProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  name?: string
  defaultValue?: string
}

interface PortProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  name?: string
  defaultValue?: string
}

const formatIPAddress = (value: string): string => {
  // Remove all non-numeric characters except dots
  const cleaned = value.replace(/[^\d.]/g, "")

  // Split by dots and process each octet
  const parts = cleaned.split(".")
  const formattedParts: string[] = []

  for (let i = 0; i < Math.min(parts.length, 4); i++) {
    let part = parts[i] || ""

    // Limit each octet to 3 digits and max value of 255
    if (part.length > 3) {
      part = part.slice(0, 3)
    }

    // Only validate and cap if there's actually a value
    if (part.length > 0) {
      const numValue = Number.parseInt(part, 10)
      if (!isNaN(numValue) && numValue > 255) {
        part = "255"
      }
    }

    formattedParts.push(part)
  }

  // Join with dots - preserve the structure the user is building
  let formatted = formattedParts.join(".")

  // Auto-add dot only when the current octet is complete and valid
  if (cleaned.length > 0 && !cleaned.endsWith(".") && formattedParts.length < 4) {
    const lastPart = formattedParts[formattedParts.length - 1]
    if (lastPart && lastPart.length === 3) {
      // Only add dot when we have exactly 3 digits
      formatted += "."
    } else if (lastPart && lastPart.length >= 2) {
      // Add dot for numbers >= 25 (since 256+ is invalid anyway)
      const num = Number.parseInt(lastPart, 10)
      if (num >= 25 && num <= 255) {
        formatted += "."
      }
    }
  }

  return formatted
}

export function IPAddress({
  name,
  className,
  placeholder = "192.168.1.1",
  defaultValue = "",
  ...props
}: IPAddressProps) {
  const [displayValue, setDisplayValue] = useState(defaultValue)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  // Initialize hidden input with default value
  useEffect(() => {
    if (hiddenInputRef.current && defaultValue) {
      hiddenInputRef.current.value = defaultValue
    }
  }, [defaultValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const formatted = formatIPAddress(rawValue)

    setDisplayValue(formatted)

    // Update hidden input for form submission
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = formatted
    }
  }

  return (
    <>
      <Input
        {...props}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={15}
        pattern="^(\d{1,3}\.){3}\d{1,3}$"
        title="Enter a valid IP address (e.g., 192.168.1.1)"
        className={cn("font-mono font-medium", className)}
      />
      {/* Hidden input for form submission */}
      <input ref={hiddenInputRef} type="hidden" name={name} value={displayValue} />
    </>
  )
}

export function Port({
  name,
  className,
  placeholder = "27015",
  defaultValue = "",
  ...props
}: PortProps) {
  const [displayValue, setDisplayValue] = useState(defaultValue)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  // Initialize hidden input with default value
  useEffect(() => {
    if (hiddenInputRef.current && defaultValue) {
      hiddenInputRef.current.value = defaultValue
    }
  }, [defaultValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "") // Only allow digits

    // Allow empty value (user can clear the field)
    if (rawValue === "") {
      setDisplayValue(rawValue)
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = rawValue
      }
      return
    }

    // Remove leading zeros except for "0" itself
    const cleanValue = rawValue.replace(/^0+/, "") || "0"
    const numValue = Number.parseInt(cleanValue, 10)

    // Limit port to valid range (0-65535)
    // Note: Port 0 is technically valid (means "any available port")
    if (numValue >= 0 && numValue <= 65535) {
      setDisplayValue(cleanValue)
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = cleanValue
      }
    }
    // If invalid, don't update the display value (effectively rejecting the input)
  }

  return (
    <>
      <Input
        {...props}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={5}
        pattern="^([1-9]\d{0,4}|0)$"
        title="Enter a port number between 0 and 65535"
        className={cn("font-mono font-medium", className)}
      />
      {/* Hidden input for form submission */}
      <input ref={hiddenInputRef} type="hidden" name={name} value={displayValue} />
    </>
  )
}
