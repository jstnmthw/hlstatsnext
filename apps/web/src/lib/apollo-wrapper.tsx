"use client"

import { HttpLink } from "@apollo/client"
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs"

// Load Apollo Client error messages in development
if (process.env.NODE_ENV === "development") {
  // Dynamic import to conditionally load dev messages
  import("@apollo/client/dev").then(({ loadErrorMessages, loadDevMessages }) => {
    loadDevMessages()
    loadErrorMessages()
  })
}

function makeClient() {
  const httpLink = new HttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
    credentials: "include",
  })

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
    devtools: {
      enabled: process.env.NODE_ENV === "development",
    },
  })
}

export function ApolloWrapper({ children }: React.PropsWithChildren) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
}
