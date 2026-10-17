# 0003. Roles through the Better Auth admin plugin, with one access statement

- Status: Accepted
- Date: 2026-10-17

## Context

Some pages, server actions and GraphQL mutations are for administrators only. Better Auth's `admin` plugin adds a role column, bans, session revocation and user management; its access-control module lets a project declare resources and actions and bind them to roles.

The plugin is in place with two roles, `admin` and `user`, and a statement in `packages/auth/src/permissions.ts` covering `server`, `game`, `player`, `user` and `dashboard`. But the statement is consulted only by some web server actions, through `auth.api.userHasPermission`. The proxy, three layouts, the header and the API context compare the role string instead. Two admin actions write the `user` table with Prisma directly. Nothing says how the first admin comes to exist on a fresh database.

Recorded on 2026-10-17: the plugin choice predates it; the single-vocabulary rule and the bootstrap are new.

## Decision

Keep the admin plugin and its two roles. The statement in `permissions.ts` is the only authorization vocabulary: it gains `hasPermission(role, permissions)`, built on the roles' own `authorize`, plus `roleOf` and `isAdmin`, and every check in the web app and the API goes through them. Set `defaultRole: "user"` and `adminRoles: ["admin"]` explicitly. Auth tables are written only through Better Auth endpoints. The first admin is whoever signs up with an address listed in `ADMIN_EMAILS`, promoted by a `user.create.before` database hook; further admins are promoted from the users page.

## Options considered

- **Admin plugin, one statement, helpers in one file.** The API checks a role it already holds in the session with no extra query; the web app checks the same statement; adding a permission is one line in one file.
- **Role string compares where needed.** Rejected. Five copies today, each a place to get wrong, and no way to grant a `user` one narrow right, which [0009](0009-claim-players-by-steam-identity.md) needs.
- **The organization plugin.** Rejected. Tenants, invitations and member tables for a site with one admin team.
- **Seeding the first admin.** Rejected for production. The fake seeder in `packages/db/src/seeders/fake` stays for local data; a production bootstrap should not need a seeder run with a password in the environment.

## Consequences

- `permissions.ts` must stay free of server-only imports; the browser client reads it too.
- Rename and anonymize in `apps/web/src/features/admin/users/actions` move to `auth.api.adminUpdateUser`, which also refreshes the cookie cache. No `db.user.update` outside Better Auth.
- `ADMIN_EMAILS` joins the environment schema ([0006](0006-validate-the-environment-at-startup.md)). It does nothing for a Steam-only account ([0007](0007-steam-email-password-and-google-sign-in.md)), whose email is synthetic; such a person signs up with an email first or is promoted by an existing admin.
- Rows written before the plugin existed may have a null role; `roleOf` reads them as `user`.
- The API's `requireAdmin` keeps answering with a `FORBIDDEN` GraphQL error; a 404 is a web page concern ([0004](0004-authorization-in-the-data-layer.md)).
