# Database tables

Put each persisted table in `src/database/<sql-table-name>/schema.ts`. Use the SQL table name for the folder, with underscores changed to hyphens, and keep the existing camel case table export. The selected Project is renderer UI state, not a database table.

Put runtime Zod validators for that table in the same folder's `validation.ts`. Name generated validators `<table>SelectSchema`, `<table>InsertSchema`, and `<table>UpdateSchema`. Add only the validator kinds that a runtime boundary uses.

Infer boundary types from those generated Zod schemas where they are used. Do not add a `types.ts` file that only renames a table or validator type.

Name pure link tables `<owner>-<related>-link`, with the owner first. Use Drizzle-inferred types for static TypeScript needs and generated Zod validators when runtime data needs parsing. Do not add unit tests that repeat Drizzle's generated field mapping; test database behavior at its boundary.
