# Architecture decision records

Short records of the decisions that shape this repository and the reasons behind them. Each record is immutable once accepted; a later record supersedes it rather than editing it. Records 0001 to 0003 were written on 2026-10-17 for decisions taken earlier, so that later records have something to point at.

| Number                                                                      | Title                                                                            | Status   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| [0001](0001-use-better-auth.md)                                             | Use Better Auth for authentication                                               | Accepted |
| [0002](0002-database-sessions-with-a-cookie-cache.md)                       | Database sessions with a cookie cache                                            | Accepted |
| [0003](0003-roles-through-the-admin-plugin-with-one-access-statement.md)    | Roles through the Better Auth admin plugin, with one access statement            | Accepted |
| [0004](0004-authorization-in-the-data-layer.md)                             | Authorization in the data layer; the proxy only routes                           | Accepted |
| [0005](0005-web-data-modules-over-the-graphql-api.md)                       | Web data modules over the GraphQL API                                            | Accepted |
| [0006](0006-validate-the-environment-at-startup.md)                         | Validate the environment at startup and build auth on first use                  | Accepted |
| [0007](0007-steam-email-password-and-google-sign-in.md)                     | Steam, email and password, and Google as sign-in methods                         | Accepted |
| [0008](0008-steam-sign-in-through-better-auth-steam.md)                     | Steam sign-in through the better-auth-steam plugin on Better Auth 1.7            | Accepted |
| [0009](0009-claim-players-by-steam-identity.md)                             | Claim players by Steam identity into a `user_players` table                      | Accepted |
| [0010](0010-development-infrastructure-credentials-are-compose-defaults.md) | Development infrastructure credentials are Compose defaults, not a root env file | Accepted |

## Writing a record

Copy `template.md` to the next number, fill in every section, and add a row here. Keep the record to one screen: the context that made the decision necessary, the decision in one or two sentences, the options that were rejected and why, and the consequences someone picking up the code should know about. A record is written when a change chooses between alternatives; the plan in `docs/plans/` says how the chosen option gets built. Write in US English and sentence case.
