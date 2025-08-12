/**
 * Event Coordinator
 *
 * Lightweight extension point for cross-module orchestration after
 * core module handlers have processed an event. Keep the interface and
 * queue processor hook to enable future coordination needs, while
 * avoiding unused concrete implementations during early development.
 */

import type { BaseEvent } from "@/shared/types/events"

/**
 * Interface for event coordinators that handle cross-module concerns
 */
export interface EventCoordinator {
  /**
   * Coordinate event processing across multiple modules
   * @param event - The event to coordinate
   */
  coordinateEvent(event: BaseEvent): Promise<void>
}
