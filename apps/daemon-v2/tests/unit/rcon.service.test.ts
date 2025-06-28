import { describe, expect, it } from "vitest";
import { RconService } from "../../src/services/rcon/rcon.service";

describe("RconService", () => {
  const rcon = new RconService();

  it("start() and stop() resolve without errors", async () => {
    await expect(rcon.start()).resolves.toBeUndefined();
    await expect(rcon.stop()).resolves.toBeUndefined();
  });

  it("executeCommand returns success message", async () => {
    const response = await rcon.executeCommand(1, "status");
    expect(response).toBe("Command executed successfully");
  });

  it("connect() resolves without errors", async () => {
    await expect(
      rcon.connect("localhost", 27015, "password"),
    ).resolves.toBeUndefined();
  });

  it("disconnect() resolves without errors", async () => {
    await expect(rcon.disconnect()).resolves.toBeUndefined();
  });

  it("sendCommand() returns an empty string", async () => {
    const response = await rcon.sendCommand("status");
    expect(response).toBe("");
  });
});
