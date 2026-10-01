# Testing rules

Read this when writing tests or fixing a bug.

- Assert observable behavior with independent test state.
- A regression test must fail on the original bug and pass with the fix.
- Test outside formats against recorded data from the real producer.

## Vendor updates

The Claude and Codex mocks answer from recordings in `apps/desktop/mocks/cli/*/recordings/`.
Each recording names the CLI version that wrote it, and `bun run typecheck` checks it against the
vendor's own types: the Agent SDK declarations for Claude, and the `bun run codex:generate-protocol`
output for Codex. The SDK types a Claude message body as `unknown`, so the decoder tests over the
recording guard the Claude content.

When the Agent SDK, the Claude CLI or the Codex CLI updates, run these from `apps/desktop`:

1. Run `bun run e2e:real`. It drives the start, reply, resume and rename journeys against the
   signed-in local CLIs, in a throwaway HOME. It is local only, because CI holds no login.
2. If it fails, or the version changed, run `bun run record:vendor-history`. It re-records both
   recordings from the installed CLIs, in a throwaway HOME. It copies only the logins
   (`~/.claude.json`, `~/.codex/auth.json`, a link to the keychain), never your Sessions. For a Codex update, also run `bun run codex:generate-protocol`.
3. Read the recording diff. Then run `bun run typecheck` and `bun run test`. A type error names
   the field the vendor changed; fix the adapter under `src/harnesses/<harness>/` that reads it.

Dependabot opens a PR for an Agent SDK bump. The Claude and Codex CLIs are not package
dependencies, so their updates show only as a new `claude --version` or `codex --version`.
