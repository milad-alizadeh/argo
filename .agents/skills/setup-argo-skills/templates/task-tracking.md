## Task tracking

Maintain a live to-do list when a task has at least three distinct steps, changes multiple files,
or follows a plan that the user approved. Use one tracker:

- If `update_plan` is available, use it and replace the complete list on each change.
- Otherwise, load `TaskCreate` and `TaskUpdate` once with
  `ToolSearch("select:TaskCreate,TaskUpdate")`. Use `TaskCreate` once per item and `TaskUpdate`
  for each status change.

- Write the list before the first edit.
- Keep exactly one item `in_progress`. Mark it `completed` as soon as its outcome is proved.
- Work in list order. Mark an item `in_progress` before you start it. Rewrite the list if the
  required order changes.
- Give each item one verifiable outcome. "Fix the bug" is an outcome. "Read the file" is an
  action.
- Use the list only for multi-step work.
- Give each required gate, test suite, render, code review, and review-fix pass its own item.
- Keep each item to one gate, suite, render, or review.
- End the list at the reviewed diff. Complete the last item when the work is proved.
- Leave the push and pull request to `/ship`. They belong to a separate invocation.
