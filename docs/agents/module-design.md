# Module design

Read this when adding or moving modules, folders, or variants.

- Group by domain, not file kind: `Tickets/`, not `Helpers/`. Keep a helper in
  its only caller's file until a second caller needs it.
- A folder hides one decision that could change. Everything inside knows that
  decision, and code outside does not. If changing the decision touches files
  outside the folder, reconsider the boundary. Folders named `util`, `common`,
  `shared`, `helpers`, `components`, or `hooks` do not name a decision.
- A new variant of an existing kind is one new file plus one registration line.
