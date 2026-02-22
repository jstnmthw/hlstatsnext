import { HttpLink } from "@apollo/client"
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs"
import { headers } from "next/headers"

const uri = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql"

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri,
      fetchOptions: { cache: "no-store" },
      fetch: async (input, init) => {
        const requestHeaders = await headers()
        const cookie = requestHeaders.get("cookie")

        // Preserve headers from Apollo (init.headers may be a Headers instance
        // which doesn't spread into a plain object)
        const merged = new Headers(init?.headers as HeadersInit)
        if (cookie) {
          merged.set("cookie", cookie)
        }

        return fetch(input, {
          ...init,
          headers: merged,
        })
      },
    }),
    devtools: {
      enabled: process.env.NODE_ENV === "development",
    },
  })
})
