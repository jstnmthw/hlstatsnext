import { execute, parse, type ExecutionResult } from "graphql"
import { describe, expect, it } from "vitest"
import type { Context } from "../../context"
import { schema } from "../../pothos-schema"

type SessionLike = NonNullable<Context["session"]>

function contextWith(role: string | null | undefined, signedIn = true): Context {
  const session = signedIn
    ? ({
        user: { id: "guard-test", role },
        session: { id: "guard-test" },
      } as unknown as SessionLike)
    : null
  return { prisma: {} as Context["prisma"], services: {} as Context["services"], session }
}

function codesOf(result: ExecutionResult): unknown[] | undefined {
  return result.errors?.map((error) => error.extensions?.code)
}

async function run(source: string, contextValue: Context): Promise<ExecutionResult> {
  return execute({ schema, document: parse(source), contextValue })
}

const adminQuery = "{ findManyUser { id } }"
// Harmless even if the guard failed: nothing matches the filter.
const adminMutation =
  'mutation { deleteManyGame(where: { code: { equals: "__guard-test__" } }) { count } }'

describe("requireAdminResolver", () => {
  it("wraps the admin-only fields this test exercises", () => {
    expect(schema.getQueryType()?.getFields().findManyUser).toBeDefined()
    expect(schema.getMutationType()?.getFields().deleteManyGame).toBeDefined()
  })

  it("answers an unauthenticated request with UNAUTHENTICATED", async () => {
    const result = await run(adminQuery, contextWith(undefined, false))
    expect(codesOf(result)).toEqual(["UNAUTHENTICATED"])
    expect(result.data?.findManyUser ?? null).toBeNull()
  })

  it("refuses a user-role session with FORBIDDEN on queries and mutations", async () => {
    expect(codesOf(await run(adminQuery, contextWith("user")))).toEqual(["FORBIDDEN"])
    expect(codesOf(await run(adminMutation, contextWith("user")))).toEqual(["FORBIDDEN"])
  })

  it("refuses a row with no role, written before the admin plugin existed", async () => {
    expect(codesOf(await run(adminQuery, contextWith(null)))).toEqual(["FORBIDDEN"])
  })

  it("refuses a role it does not know", async () => {
    expect(codesOf(await run(adminQuery, contextWith("superuser")))).toEqual(["FORBIDDEN"])
  })
})
