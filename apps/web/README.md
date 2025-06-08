# Web Frontend

Next.js frontend application for HLStatsNext.

## Overview

This application provides the user interface for HLStatsNext, built with modern web technologies to deliver a fast, responsive, and type-safe experience.

- **Framework**: Next.js 15 with App Router
- **UI**: React Server Components & Tailwind CSS
- **State Management**: Apollo Client for GraphQL state
- **Type Safety**: Full TypeScript integration with code generation

## Setup

1.  **Install dependencies from the root of the monorepo:**
    ```bash
    pnpm install
    ```
2.  **Run the development server:**
    ```bash
    pnpm dev
    ```

The application will be available at [http://localhost:3000](http://localhost:3000). The page auto-updates as you edit files.

## Scripts

- `pnpm dev`: Start the development server with hot reload
- `pnpm build`: Build for production
- `pnpm start`: Start the production server
- `pnpm lint`: Run ESLint for code quality checks
- `pnpm graphql:codegen`: Generate a typed GraphQL client from the API schema

## GraphQL API Consumption

This application connects to the GraphQL API provided by the `api` package. We use Apollo Client for state management and `graphql-codegen` for generating a type-safe SDK.

### Code Generation

To ensure type safety and generate React hooks, we use `graphql-codegen`. Any time you add or change a GraphQL query or mutation, you must regenerate the client SDK.

1.  Make sure the `api` development server is running.
2.  Run the codegen script from the `apps/web` directory:

```bash
pnpm graphql:codegen
```

This will generate updated types and hooks in `src/lib/gql/`. The script is configured in `codegen.ts`.

### Apollo Client Setup

The Apollo Client is configured to work with Next.js App Router, supporting both Server-Side Rendering (SSR) in Server Components and client-side data fetching in Client Components.

- **Client Configuration**: The client instance is created in `src/lib/apollo-client.ts`.
- **Provider**: The root layout is wrapped in an `ApolloProvider` in `src/components/apollo-provider.tsx` to make the client available throughout the component tree.

### Usage Example (Client Component)

In Client Components, you can use the auto-generated hooks from `graphql-codegen`.

```typescript
'use client';

import { useQuery } from '@apollo/client';
import { graphql } from '@/lib/gql';

// This query is defined and typed by graphql-codegen
const GET_PLAYERS_QUERY = graphql(`
  query GetPlayers {
    players(orderBy: { skill: desc }, take: 10) {
      id
      name
      skill
    }
  }
`);

function PlayerList() {
  const { loading, error, data } = useQuery(GET_PLAYERS_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data?.players.map(player => (
        <li key={player.id}>{player.name} ({player.skill})</li>
      ))}
    </ul>
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
