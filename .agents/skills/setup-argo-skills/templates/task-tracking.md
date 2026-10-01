## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TaskCreate` one call per item,
then `TaskUpdate` for each status change — both are deferred, so load them once with
`ToolSearch("select:TaskCreate,TaskUpdate")` before the first edit. Codex: `update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done.
- Work the items **in the order the list gives them**, and mark an item `in_progress` **before**
  starting it. If the real order turns out to be different, reorder rather than skip an item.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list.
- **Split the verification tail into one item each**: the gates, the test suite, the render, the
  code review, the review fixes. Only the ones the change needs, never two folded together.
- **No item holds more than one gate, suite or review.** A subject that comma-lists what it
  covers — "Verify: gates, render, review", "Full suites, quality gates, review, commit" — is
  the shape to reject.
- **The list runs to the reviewed diff**, so the last item completes when the work is proved.
- **The push and the PR are `/ship`'s, and never an item you write yourself.** `/ship` is a
  separate invocation the caller makes, and it carries the close-out nothing else runs.
