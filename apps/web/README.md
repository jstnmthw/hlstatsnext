# Web Application

This Next.js application (`apps/web`) serves as the frontend for the HLStatsNext project. It uses the App Router and is configured for Server-Side Rendering (SSR) with Apollo Client, following the patterns from `@apollo/client-integration-nextjs`.

## GraphQL Setup

The project is configured for end-to-end type-safe data fetching using GraphQL, with full support for RSC and Client Components.

### 1. Code Generation

The GraphQL client and typed hooks are automatically generated from the queries and mutations defined within this application. To regenerate the client after adding or changing a GraphQL operation, run the following command from the root of the monorepo:

```bash
pnpm codegen
```

This script reads all `.ts` and `.tsx` files, finds the GraphQL operations defined with the `graphql()` function, and generates the necessary code in `lib/gql/`.

### 2. Fetching Data in Server Components (RSC)

For Server-Side Rendering (SSR), always use the `getClient` function or the `query` shortcut from `@/lib/apollo-client` to fetch data within Server Components. This ensures that a new Apollo Client instance is used for each request.

**Example: A Server Component**

```typescript
import { getClient } from "@/lib/apollo-client";
// Or use the shortcut:
// import { query } from "@/lib/apollo-client";
import { graphql } from "@/lib/gql";

const GET_GAMES_QUERY = graphql(`...`);

export async function GameList() {
  // const { data } = await query({ query: GET_GAMES_QUERY });
  const { data } = await getClient().query({ query: GET_GAMES_QUERY });

  return (
    //... render component
  );
}
```

### 3. Data in Client Components

The client-side Apollo setup is handled by `app/ApolloWrapper.tsx`, which uses `ApolloNextAppProvider` to make the client available to all Client Components.

#### Using `useSuspenseQuery`

For queries in Client Components that should suspend while loading, use the `useSuspenseQuery` hook.

```typescript
"use client";

import { useSuspenseQuery } from "@apollo/client";
import { graphql } from "@/lib/gql";

const GET_PLAYERS_QUERY = graphql(`...`);

function PlayerList() {
  const { data } = useSuspenseQuery(GET_PLAYERS_QUERY);

  return (
    //... render component with data
  );
}
```

#### Preloading Data in RSC for Client Components

To avoid client-side request waterfalls, you can preload data in a Server Component and have it available immediately in a Client Component.

**Example: Preloading in a Server Page/Component**

```typescript
import { PreloadQuery } from "@/lib/apollo-client";
import { graphql } from "@/lib/gql";
import { Suspense } from "react";
import { ClientChild } from "./ClientChild";

const GET_PLAYERS_QUERY = graphql(`...`);

export default function Page() {
    return (
        <PreloadQuery query={GET_PLAYERS_QUERY}>
            <Suspense fallback={<p>Loading...</p>}>
                <ClientChild />
            </Suspense>
        </PreloadQuery>
    )
}
```

**Example: Consuming preloaded data in `ClientChild.tsx`**

```typescript
"use client";

import { useSuspenseQuery } from "@apollo/client";
import { graphql } from "@/lib/gql";

const GET_PLAYERS_QUERY = graphql(`...`);

export function ClientChild() {
  // This hook will not trigger a new network request.
  // It will use the data preloaded in the parent Server Component.
  const { data } = useSuspenseQuery(GET_PLAYERS_QUERY);

  return (
    //... render component
  );
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
