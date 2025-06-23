import { describe, expect, it } from "vitest";
import { RconService } from "../../src/services/rcon/rcon.service";

describe("RconService", () => {
  it("start() and stop() resolve without errors", async () => {
    const rcon = new RconService();

    await expect(rcon.start()).resolves.toBeUndefined();
    await expect(rcon.stop()).resolves.toBeUndefined();
  });

  it("executeCommand returns success message", async () => {
    const rcon = new RconService();
    const response = await rcon.executeCommand(1, "status");
    expect(response).toBe("Command executed successfully");
  });
});
