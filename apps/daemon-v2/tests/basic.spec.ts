import { describe, it, expect } from "vitest";
import { hello } from "../src/index";

describe("basic hello test", () => {
  it("should return greeting", () => {
    expect(hello()).toBe("Hello HLStatsDaemon");
  });
});
