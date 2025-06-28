"use client"

import { ApolloLink, HttpLink } from "@apollo/client"
import { ApolloNextAppProvider, InMemoryCache, SSRMultipartLink, ApolloClient } from "@apollo/client-integration-nextjs"

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
  })
}

export function ApolloProviderWrapper({ children }: React.PropsWithChildren) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
}
