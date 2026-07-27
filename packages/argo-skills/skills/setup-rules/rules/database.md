---
paths:
  - "{{DB_GLOBS}}"
---

# Database Rules

The schema is the source of truth for what the data *is*. Everything downstream — types,
queries, fixtures, docs — is derived from it, and derived things are generated, never
hand-maintained. The moment a hand-written type and the schema disagree, the type wins in
the editor and the schema wins at runtime, which is the worst possible split.

Applies to `{{MIGRATIONS_DIR}}`, `{{SCHEMA_FILE}}`, and the data-access modules.

## The schema changes through migrations, and only through migrations

- **Forbidden:** altering a table by hand, through a GUI, or with an ad-hoc statement in any
  environment that has ever held real data. If it isn't in `{{MIGRATIONS_DIR}}`, it will not
  exist on the next machine.
- **Forbidden:** editing a migration that has already run anywhere. It has run; the file is
  now a historical record and rewriting it makes two databases that claim the same version
  and differ. The fix for a bad migration is the next migration.
- **Forbidden:** a migration with no down path *and* no note saying why it is irreversible.
  One or the other, always.

Write migrations with `{{MIGRATION_CMD}}`.

## Types are generated from the schema, in the same change

- **Forbidden:** hand-writing a type that mirrors a table. It is a copy of something that
  already exists, and copies drift silently.
- **Forbidden:** landing a migration without re-running `{{TYPEGEN_CMD}}` and committing the
  result. A schema change whose generated types land a commit later is a broken build for
  everyone who pulls in between.

Generated files are not edited (`file-structure.md`), and they are exempt from the line
ceiling by kind, not by ratchet.

## A generated row shape is not a domain type

The row shape belongs to storage and changes when storage changes. Map it into the domain
type at the data-access boundary and let the rest of the program depend on that
(`domain-types.md`). A column rename should not reach a component.

## Every query goes through the data-access module

- **Forbidden:** a query in a handler, a component, or a job. Data access is a tier
  (`file-structure.md`), and its public entry is how the rest of the app reads and writes.
- **Forbidden:** string-concatenated SQL with a value in it — parameterize, always, including
  in scripts and one-off migrations. There is no query too small to be an injection.
- **Forbidden:** a query with no bound on what it returns. Unbounded reads pass every test on
  a fixture database and fall over on the first real one.

## Constraints live in the database, not only in the application

The application is one of the writers. Migrations, scripts, another service, and a human at
a console are the others, and the database is the only rule that applies to all of them.

- **Forbidden:** an invariant enforced only in application code — a required field that is
  nullable in the schema, a uniqueness rule with no unique index, a relation with no foreign
  key.
- **Forbidden:** a foreign key with no deliberate delete behaviour. Choose cascade, restrict,
  or null; leaving it to the default is a decision made by whoever wrote the driver.

## Destructive changes expand before they contract

Dropping or renaming a column in one migration breaks every process still running the old
code, which is every process during a deploy.

1. **Expand** — add the new shape, write both, read the old one.
2. **Migrate** — backfill, then switch reads to the new shape.
3. **Contract** — once nothing reads the old shape, drop it, in its own migration.

Steps 1 and 3 are separate deploys. A single migration that renames a column is only safe on
a database nobody is using.

## Self-check before you finish

1. Does this change alter the schema anywhere other than `{{MIGRATIONS_DIR}}`?
2. Have the generated types been regenerated and committed in this same change?
3. Is any invariant enforced in code but not in the schema?
4. Does any query live outside the data-access tier, or carry an interpolated value?
5. Does this migration drop or rename something that running code still reads?
