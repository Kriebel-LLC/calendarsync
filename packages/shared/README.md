# Shared

A collection of shared code, business logic, convenience methods, etc. usable between packages.

Shared frontend code should not be included in this package - that should go into the `components` package.

# DB

Uses Drizzle ORM to interface with Cloudflare D1-hosted DB.

## Commands

`db:migrate-gen`: create a new migration
`db:migrate-run`: runs any non-applied migrations
`db:migrate-drop`: drops non-run migrations
`db:pull`: creates a schema file locally from the remote DB

## Migration flow

Local and staging environments should ALWAYS be run against the DB's `dev` branch and NEVER `production`.

To migrate the `production` DB branch, merge the schema changes in from `dev` to `production` within Planetscale.

To make breaking schema changes, first create a safe migration that can run in parallel and modify all code to use the new schema. Once all traffic is migrated over to use the new schema & codepath, create another migration to safely make the breaking change (which should be safe to do now.)
