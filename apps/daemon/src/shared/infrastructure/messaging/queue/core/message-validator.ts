/**
 * Message parsing + semantic validation helpers used by EventConsumer.
 *
 * Parse failures are recoverable (we reject the message); validation failures
 * surface as thrown errors so the consumer's retry/DLQ pipeline handles them
 * uniformly with downstream processor errors.
 */

import { safeJsonParse } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { ConsumeMessage, EventMessage, MessageValidator } from "./types"

export type MessageParseResult =
  | { success: true; data: EventMessage }
  | { success: false; error: string }

export function parseMessage(msg: ConsumeMessage): MessageParseResult {
  try {
    const content = msg.content.toString("utf8")
    return safeJsonParse<EventMessage>(content)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const defaultMessageValidator: MessageValidator = async (message) => {
  if (!message.id) {
    throw new Error("Message missing ID")
  }

  if (!message.payload) {
    throw new Error("Message missing payload")
  }

  if (!message.payload.eventType) {
    throw new Error("Message payload missing eventType")
  }

  if (!message.metadata) {
    throw new Error("Message missing metadata")
  }

  if (typeof message.metadata.source.serverId !== "number") {
    throw new Error("Message metadata missing or invalid serverId")
  }
}
