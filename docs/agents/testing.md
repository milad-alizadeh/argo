# Testing rules

Read this when writing tests or fixing a bug.

- Assert observable behavior with independent test state.
- A regression test must fail on the original bug and pass with the fix.
- Test outside formats against recorded data from the real producer.

## Vendor updates

The Claude and Codex mocks answer from recordings in `apps/desktop/mocks/recordings/<producer>/<version>/`.
Each recording carries `producer`, `version` and `recordedAt`. The loader rejects missing tags or
a producer or version that disagrees with its folder. Older captures use `recordedAt: null` where
the capture date was not saved; new captures use an ISO timestamp. `bun run typecheck` checks the
typed history recordings against the
vendor's own types: the Agent SDK declarations for Claude, and the `bun run codex:generate-protocol`
output for Codex. The SDK types a Claude message body as `unknown`, so the decoder tests over the
recording guard the Claude content.

When the Agent SDK, the Claude CLI or the Codex CLI updates, run these from `apps/desktop`:

1. For an Agent SDK bump, first update the packaging lockfile. A Dependabot PR updates only
   `bun.lock`. Run `npm install --package-lock-only --workspaces=false`. Without
   `--workspaces=false`, npm writes a root `package-lock.json` and leaves
   `apps/desktop/package-lock.json` stale.
2. Run `bun run e2e:real`. It drives the start, reply, resume and rename journeys against the
   signed-in local CLIs, in a throwaway HOME. It is local only, because CI holds no login.
3. If it fails, or the version changed, run `bun run record:vendor-history`. It re-records Claude and Codex history plus the Codex model catalog from the installed CLIs, in a throwaway HOME. It copies only the logins
   (`~/.claude.json`, `~/.codex/auth.json`, a link to the keychain), never your Sessions. It saves responses in the repository before deleting the temporary home;
   replay does not need those Sessions or a login. When a CLI version changes, it creates a new
   version folder and refreshes the generated imports. Each producer needs a complete folder:
   record the remaining responses before switching versions, then run `bun run recordings:sync`.
   Keep other captures under their original version until they are recorded again. The command
   currently captures history and the Codex model catalog; the other recordings retain their
   existing capture sources. For a Codex update, also run `bun run codex:generate-protocol`.
4. Read the recording diff. Then run `bun run typecheck` and `bun run test`. A type error names
   the field the vendor changed; fix the adapter under `src/harnesses/<harness>/` that reads it.
5. For an Agent SDK bump, also update the package manifest. A new SDK version can add files. Run
   `bun run build`, then `bun run desktop:manifest --write`. Read the manifest diff.

Dependabot opens a PR for an Agent SDK bump. The Claude and Codex CLIs are not package
dependencies, so their updates show only as a new `claude --version` or `codex --version`.
