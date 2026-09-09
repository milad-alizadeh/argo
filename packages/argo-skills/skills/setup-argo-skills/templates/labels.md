## Labels

Every issue is labelled in the `gh issue create` call. There is no unlabelled issue, and a bug
report is no exception.

- **One triage label, always**: `{{READY_FOR_AGENT}}` when the issue is specified well enough
  for an AFK agent to build it, `{{READY_FOR_HUMAN}}` when a person must do the work,
  `{{NEEDS_INFO}}` when the report is short of a fact only the reporter holds, and
  `{{NEEDS_TRIAGE}}` when you cannot tell. A closing-only label such as `{{WONTFIX}}` is never a
  create-time one.
- **One kind label when the kind is clear**: `{{BUG}}` for behaviour that is broken,
  `{{ENHANCEMENT}}` for behaviour that is new, `{{DOCUMENTATION}}` for docs, designs and ADRs.

You know which triage label fits at the moment you write the body, so the create call is where it
goes. An issue that lands unlabelled falls into `/triage`'s never-triaged bucket, and a person
must read it again to learn what you already knew.
