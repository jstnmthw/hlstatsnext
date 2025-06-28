# GraphQL Error Handling Best Practices

## Overview

This document outlines the comprehensive error handling strategy implemented in the HLStatsNext GraphQL API. The system provides consistent, secure, and user-friendly error responses while maintaining detailed logging for debugging.

**Our approach follows GraphQL Yoga's recommended patterns exactly:**

- Use `GraphQLError` instances for expected errors (these are NOT masked)
- Let GraphQL Yoga automatically mask unexpected `Error` instances
- Place error codes in the `extensions` property

## Architecture

### 1. **Result Pattern in Services**

All service methods return a `Result<T, E>` type that represents either success or failure:

```typescript
type Result<T, E> = Success<T> | Failure<E>

interface Success<T> {
  readonly success: true
  readonly data: T
}

interface Failure<E> {
  readonly success: false
  readonly error: E
}
```

**Example Service Method:**

```typescript
async getGameStats(gameId: string): Promise<Result<GameStatistics, AppError>> {
  try {
    const game = await this.db.game.findUnique({
      where: { code: gameId },
    });

    if (!game) {
      return failure({
        type: "NOT_FOUND",
        message: "Game not found",
        resource: "game",
        id: gameId,
      });
    }

    // ... business logic ...

    return success(gameStatistics);
  } catch (error) {
    return failure({
      type: "DATABASE_ERROR",
      message: "Failed to calculate game statistics",
      operation: "getGameStats",
    });
  }
}
```

### 2. **Structured Application Errors**

All application errors implement the `AppError` type with specific error types:

```typescript
type AppError = NotFoundError | ValidationError | DatabaseError | UnauthorizedError

interface NotFoundError {
  readonly type: "NOT_FOUND"
  readonly message: string
  readonly resource: string
  readonly id: string
}

interface ValidationError {
  readonly type: "VALIDATION_ERROR"
  readonly message: string
  readonly field: string
  readonly value: unknown
}

interface DatabaseError {
  readonly type: "DATABASE_ERROR"
  readonly message: string
  readonly operation: string
}

interface UnauthorizedError {
  readonly type: "UNAUTHORIZED"
  readonly message: string
}
```

### 3. **GraphQL Error Transformation**

Application errors are transformed into standard GraphQL errors following GraphQL Yoga patterns:

```typescript
import { GraphQLError } from "graphql"

// Simple function that maps service errors to GraphQL errors
export function mapAppErrorToGraphQLError(error: AppError): GraphQLError {
  switch (error.type) {
    case "NOT_FOUND":
      return new GraphQLError(`The requested ${error.resource} was not found.`, {
        extensions: {
          code: "NOT_FOUND",
          details: {
            resource: error.resource,
            id: error.id,
          },
        },
      })
    // ... other error types
  }
}
```

### 4. **Automatic Error Masking by GraphQL Yoga**

GraphQL Yoga automatically handles error security:

- **Expected errors** (`GraphQLError` instances): Pass through with full details
- **Unexpected errors** (regular `Error` instances): Automatically masked in production
- **Error codes**: Placed in `extensions.code` following GraphQL spec

## Implementation Patterns

### 1. **Resolver Error Handling**

Use the provided utility functions to handle Result types in resolvers:

```typescript
import { handleGraphQLResult, handleGraphQLResultNullable } from "../utils/graphql-result-handler"

// For non-nullable fields (will throw GraphQLError on failure)
builder.queryField("gameStats", (t) =>
  t.field({
    type: GameStatistics,
    args: {
      gameId: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.game.getGameStats(args.gameId)
      return handleGraphQLResult(result) // Throws GraphQLError if failed
    },
  }),
)

// For nullable fields (will return null on error)
builder.queryField("playerStats", (t) =>
  t.field({
    type: PlayerStatistics,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.player.getPlayerStats(args.id)
      return handleGraphQLResultNullable(result) // Returns null if failed
    },
  }),
)
```

### 2. **Error Response Format**

Clients receive structured error responses automatically formatted by GraphQL Yoga:

**Success Response:**

```json
{
  "data": {
    "gameStats": {
      "totalPlayers": 1500,
      "activePlayers": 245,
      "totalKills": 450000
    }
  }
}
```

**Error Response (User-Friendly):**

```json
{
  "errors": [
    {
      "message": "The requested game was not found.",
      "path": ["gameStats"],
      "extensions": {
        "code": "NOT_FOUND",
        "details": {
          "resource": "game",
          "id": "invalid-game-id"
        }
      }
    }
  ],
  "data": {
    "gameStats": null
  }
}
```

**Unexpected Error (Masked in Production):**

```json
{
  "errors": [
    {
      "message": "Unexpected error.",
      "path": ["gameStats"]
    }
  ],
  "data": {
    "gameStats": null
  }
}
```

**Unexpected Error (Development Mode):**

```json
{
  "errors": [
    {
      "message": "Database connection failed",
      "path": ["gameStats"],
      "extensions": {
        "originalError": {
          "message": "Connection refused",
          "stack": "Error: Connection refused\n    at Database.connect..."
        }
      }
    }
  ],
  "data": {
    "gameStats": null
  }
}
```

## Error Handling Utilities

### 1. **Result Handlers**

```typescript
// Throws GraphQLError on failure, returns data on success
function handleGraphQLResult<T>(result: Result<T, AppError>): T

// Returns null on failure (with warning log), returns data on success
function handleGraphQLResultNullable<T>(result: Result<T, AppError>): T | null

// Async versions
async function handleGraphQLResultAsync<T>(resultPromise: Promise<Result<T, AppError>>): Promise<T>
async function handleGraphQLResultNullableAsync<T>(resultPromise: Promise<Result<T, AppError>>): Promise<T | null>
```

### 2. **Direct GraphQLError Creation**

For cases where you need to create errors directly in resolvers:

```typescript
import { GraphQLError } from "graphql"

// Create a GraphQL error with proper extensions
throw new GraphQLError("User not found", {
  extensions: {
    code: "NOT_FOUND",
    details: {
      userId: "123",
    },
  },
})
```

## Server Configuration

**No special configuration needed!** GraphQL Yoga handles error masking automatically:

```typescript
const yoga = createYoga({
  schema,
  context: createContext,
  // GraphQL Yoga automatically masks unexpected errors
  // GraphQLError instances pass through unchanged
})
```

## Logging Strategy

### 1. **Application Errors (Expected)**

- Logged at WARN level with context in `handleGraphQLResultNullable`
- User-friendly messages returned to client via GraphQLError
- Full error context preserved in logs

### 2. **Unexpected Errors**

- Automatically logged by GraphQL Yoga
- Masked in production ("Unexpected error.")
- Full details shown in development mode

### 3. **Log Format**

```typescript
// Our warning logs for nullable results
console.warn(`GraphQL nullable result failed:`, {
  error: result.error,
  timestamp: new Date().toISOString(),
})
```

## Security Considerations

1. **Automatic Masking**: GraphQL Yoga masks unexpected errors by default
2. **Safe GraphQLErrors**: Our `mapAppErrorToGraphQLError` only exposes safe, user-friendly messages
3. **Development Mode**: Stack traces only shown when `NODE_ENV=development`
4. **No Custom Masking**: We rely on GraphQL Yoga's battle-tested error masking

## Best Practices

### 1. **Service Layer**

- Always return Result types
- Use specific error types with descriptive messages
- Include operation context in errors
- Handle expected failures gracefully

### 2. **GraphQL Resolvers**

- Keep resolvers thin - delegate to services
- Use `handleGraphQLResult()` for non-nullable fields
- Use `handleGraphQLResultNullable()` for optional fields
- Never throw generic `Error` instances (they get masked)

### 3. **Error Messages**

- Write user-friendly messages in `mapAppErrorToGraphQLError`
- Include helpful context in error details
- Use consistent error codes in extensions
- Provide actionable information when possible

### 4. **Testing**

- Test both success and failure paths
- Verify error codes in extensions
- Test with `NODE_ENV=production` to verify masking
- Validate that GraphQLErrors pass through correctly

## Common Patterns

### 1. **Resource Not Found**

```typescript
// Service
if (!resource) {
  return failure({
    type: "NOT_FOUND",
    message: `${resourceType} not found`,
    resource: resourceType,
    id: resourceId,
  })
}

// Resolver (nullable field - returns null gracefully)
const data = handleGraphQLResultNullable(result)
if (!data) return null

// Resolver (non-nullable field - throws GraphQLError)
return handleGraphQLResult(result)
```

### 2. **Validation Errors**

```typescript
// Service
if (!isValidEmail(email)) {
  return failure({
    type: "VALIDATION_ERROR",
    message: "Invalid email format",
    field: "email",
    value: email,
  })
}

// Resolver (will throw GraphQLError with BAD_USER_INPUT code)
return handleGraphQLResult(result)
```

### 3. **Database Errors**

```typescript
// Service
try {
  const result = await this.db.operation()
  return success(result)
} catch (error) {
  return failure({
    type: "DATABASE_ERROR",
    message: "Operation failed",
    operation: "operationName",
  })
}

// Result becomes GraphQLError with INTERNAL_SERVER_ERROR code
```

## Migration Guide

When adding error handling to existing resolvers:

1. **Update Service Methods**: Ensure they return Result types
2. **Import Utilities**: `import { handleGraphQLResult } from "../utils/graphql-result-handler"`
3. **Replace Error Throwing**: Use `handleGraphQLResult(result)` instead of manual error handling
4. **Choose Nullability**: Use `handleGraphQLResultNullable` for optional fields
5. **Test Error Paths**: Verify GraphQLError codes appear correctly in extensions

## Development Tips

### 1. **Testing Error Responses**

```bash
# Start in development mode to see full error details
NODE_ENV=development pnpm dev

# Test with production-like masking
NODE_ENV=production pnpm dev
```

### 2. **Expected Error Codes**

- `NOT_FOUND` - Resource doesn't exist
- `BAD_USER_INPUT` - Invalid input validation
- `UNAUTHORIZED` - Authentication required
- `INTERNAL_SERVER_ERROR` - Database/system errors

### 3. **Debugging**

- Check console logs for service layer errors
- Verify `extensions.code` in GraphQL responses
- Use GraphiQL in development for easy testing

## Future Enhancements

1. **Error Analytics**: Track error patterns using extensions data
2. **Custom Error Codes**: Add domain-specific error codes as needed
3. **Rate Limiting**: Add RATE_LIMITED error type
4. **Monitoring**: Integrate with error tracking services
5. **Documentation**: Auto-generate error code documentation
