import { describe, expect, it } from "vitest";
import { GatewayService } from "../../src/services/gateway/gateway.service";

// GatewayService currently contains placeholder logic. This unit test simply
// verifies that the service can start and stop without throwing.

describe("GatewayService", () => {
  it("start() and stop() resolve without errors", async () => {
    const gateway = new GatewayService();

    await expect(gateway.start()).resolves.toBeUndefined();
    await expect(gateway.stop()).resolves.toBeUndefined();
  });
});
