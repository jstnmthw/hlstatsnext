import { HttpLink } from "@apollo/client"
import {
  registerApolloClient,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs"

const uri = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql"

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri,
    }),
    devtools: {
      enabled: process.env.NODE_ENV === "development",
    },
  })
})
