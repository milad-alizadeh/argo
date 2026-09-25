# Database tables

Put each refactored persisted table in `src/database/<sql-table-name>/schema.ts`. Use the SQL table name for the folder, with underscores changed to hyphens, and keep the existing camel case table export. Project Setup tables stay in `project-tables.ts` until that model is revisited.

Put each table's inferred TypeScript aliases in the same folder's `types.ts`. Name the selected row type `<Thing>Row` and the insert type `New<Thing>`. Derive both from the Drizzle table.

Put runtime Zod validators for that table in the same folder's `validation.ts`. Name generated validators `<table>SelectSchema`, `<table>InsertSchema`, and `<table>UpdateSchema`. Add only the validator kinds that a runtime boundary uses.

Name pure link tables `<owner>-<related>-link`, with the owner first. Name association tables with domain meaning for that concept, such as `project-workspace-selection`. Use Drizzle-inferred types for static TypeScript needs and generated Zod validators when runtime data needs parsing. Do not add unit tests that repeat Drizzle's generated field mapping; test database behavior at its boundary.
