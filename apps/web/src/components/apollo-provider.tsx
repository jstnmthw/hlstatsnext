"use client"

import { ApolloLink, HttpLink } from "@apollo/client"
import {
  ApolloNextAppProvider,
  InMemoryCache,
  SSRMultipartLink,
  ApolloClient,
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
    uri: "http://localhost:4000/graphql",
  })

  return new ApolloClient({
    cache: new InMemoryCache(),
    link:
      typeof window === "undefined"
        ? ApolloLink.from([
            new SSRMultipartLink({
              stripDefer: true,
            }),
            httpLink,
          ])
        : httpLink,
    devtools: {
      enabled: process.env.NODE_ENV === "development",
    },
  })
}

export function ApolloProviderWrapper({ children }: React.PropsWithChildren) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
}
