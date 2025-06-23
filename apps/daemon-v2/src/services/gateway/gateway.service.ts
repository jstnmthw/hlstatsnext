/*
  GatewayService
  --------------
  Responsible for managing external connections (HTTP/WS/etc.) that deliver raw
  HLStats events into the daemon. Implementation is intentionally minimal for
  Phase 1; methods return resolved Promises to satisfy the interface.
*/

export interface IGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class GatewayService implements IGatewayService {
  async start(): Promise<void> {
    // TODO: Initialize Fastify server / WebSocket listeners
    // Placeholder implementation – do nothing for now
    return;
  }

  async stop(): Promise<void> {
    // TODO: Gracefully close connections
    return;
  }
}
