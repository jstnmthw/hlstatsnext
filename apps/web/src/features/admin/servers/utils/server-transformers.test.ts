import { describe, expect, it } from "vitest"
import {
  extractFormDataForCreate,
  extractFormDataForUpdate,
  prepareCreateServerInput,
  prepareUpdateServerInput,
} from "./server-transformers"

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v)
  }
  return fd
}

describe("extractFormDataForCreate", () => {
  it("extracts create fields from FormData", () => {
    const fd = makeFormData({
      address: "192.168.1.1",
      port: "27015",
      game: "css",
      mod: "",
      rconPassword: "secret",
    })

    const result = extractFormDataForCreate(fd)
    expect(result.address).toBe("192.168.1.1")
    expect(result.port).toBe("27015")
    expect(result.game).toBe("css")
    expect(result.rconPassword).toBe("secret")
  })

  it("returns null for missing fields", () => {
    const fd = new FormData()
    const result = extractFormDataForCreate(fd)
    expect(result.address).toBeNull()
    expect(result.port).toBeNull()
  })
})

describe("extractFormDataForUpdate", () => {
  it("extracts update fields from FormData", () => {
    const fd = makeFormData({
      serverId: "1",
      name: "My Server",
      address: "10.0.0.1",
      port: "27015",
      game: "css",
      mod: "",
      publicAddress: "play.example.com",
      statusUrl: "https://status.example.com",
      rconPassword: "",
      sortOrder: "5",
    })

    const result = extractFormDataForUpdate(fd)
    expect(result.serverId).toBe("1")
    expect(result.name).toBe("My Server")
    expect(result.publicAddress).toBe("play.example.com")
    expect(result.sortOrder).toBe("5")
  })
})

describe("prepareCreateServerInput", () => {
  it("prepares input for server creation", () => {
    const data = {
      address: "192.168.1.1",
      port: 27015,
      game: "css",
      mod: null,
      rconPassword: "secret",
    }

    const result = prepareCreateServerInput(data)
    expect(result.address).toBe("192.168.1.1")
    expect(result.port).toBe(27015)
    expect(result.game).toBe("css")
    expect(result.rconPassword).toBe("secret")
  })

  it("defaults rconPassword to empty string when null", () => {
    const data = {
      address: "192.168.1.1",
      port: 27015,
      game: "css",
      mod: null,
      rconPassword: null,
    }

    const result = prepareCreateServerInput(data)
    expect(result.rconPassword).toBe("")
  })
})

describe("prepareUpdateServerInput", () => {
  it("prepares server update input", () => {
    const data = {
      serverId: 1,
      name: "My Server",
      address: "192.168.1.1",
      port: 27015,
      game: "css",
      mod: null,
      publicAddress: "play.example.com",
      statusUrl: "https://status.example.com",
      rconPassword: "pass",
      sortOrder: 5,
    }

    const result = prepareUpdateServerInput(data)
    expect(result.port).toEqual({ set: 27015 })
    expect(result.address).toEqual({ set: "192.168.1.1" })
    expect(result.name).toEqual({ set: "My Server" })
    expect(result.publicAddress).toEqual({ set: "play.example.com" })
    expect(result.statusUrl).toEqual({ set: "https://status.example.com" })
    expect(result.rconPassword).toEqual({ set: "pass" })
    expect(result.sortOrder).toEqual({ set: 5 })
  })

  it("trims optional string fields", () => {
    const data = {
      serverId: 1,
      name: "  Trimmed  ",
      address: "10.0.0.1",
      port: 27015,
      game: "css",
      mod: null,
      publicAddress: "  trimmed.example.com  ",
      statusUrl: "  https://example.com  ",
      rconPassword: "  password  ",
      sortOrder: 0,
    }

    const result = prepareUpdateServerInput(data)
    expect(result.name).toEqual({ set: "Trimmed" })
    expect(result.publicAddress).toEqual({ set: "trimmed.example.com" })
    expect(result.statusUrl).toEqual({ set: "https://example.com" })
    expect(result.rconPassword).toEqual({ set: "password" })
  })

  it("omits empty optional fields", () => {
    const data = {
      serverId: 1,
      name: "",
      address: "10.0.0.1",
      port: 27015,
      game: "css",
      mod: null,
      publicAddress: "",
      statusUrl: "",
      rconPassword: "",
      sortOrder: 0,
    }

    const result = prepareUpdateServerInput(data)
    expect(result.name).toBeUndefined()
    expect(result.publicAddress).toBeUndefined()
    expect(result.statusUrl).toBeUndefined()
    expect(result.rconPassword).toBeUndefined()
  })
})
