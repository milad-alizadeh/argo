# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Quality gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the two configs that **fail silently open**, and how to
prove a change to them.

## What runs where

`bun run quality` is biome, duplication and Swift. `quality:swift` (SwiftFormat in check mode,
SwiftLint, package boundaries) needs a macOS runner, so it sits on the `macos` CI job alongside
the build and the swift-testing suites. Linux CI runs biome, duplication and `test:hooks` — the
only executable suite there. Pre-commit runs lint-staged: biome, then SwiftFormat, SwiftLint,
boundaries and the design-token gate over staged Swift.

Biome's escape-hatch bans (`any`, `@ts-ignore`, `!`, nested ternaries) are TypeScript-only and
so have no subject since ADR-0023. Dormant, like the boundary gates — the per-file caps still
apply to every tracked `.mjs`.

## Where an exemption goes

Exemptions live in **three** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |
| the module map's `placement` block | the folder rules — `allow`/`ratchet`/`exclude`, each value its own reason |
| `.swiftlint.yml` | the Swift caps, ratchets inline — including the initializer cap that `swift-boundaries.sh` edge 6 reads from there and SwiftLint itself cannot check |

The placement gates fail on a **stale** exemption too: an entry naming no file is deleted, not
left to re-authorise a future breach.

Two caps have no rule to enforce them and live in `rules/` prose only: `as` assertions, and
exhaustive `switch` over a union.

## Why the exemption reasons live in sidecars

**Biome silently checks zero files if `biome.json` holds a comment.** Hence `biome.jsonc` — the
overrides are annotated inline, and the `.jsonc` extension is what makes that legal.

**jscpd's auto-discovery silently skips the entire `.jscpd.json` if that file holds a comment**
(you get no threshold and a larger file count, with no error), and JSON is its only config
format. Hence the sidecar `scripts/jscpd-ignore-reasons.txt`, one reason per ignore glob.

## Why `--config .jscpd.json` is load-bearing

`quality:duplication` passes **`--config .jscpd.json` explicitly**. An explicitly-named config is
*parsed* rather than *discovered*, so a malformed one prints

```
config file .jscpd.json line 1: expected value
```

and exits non-zero, instead of quietly running unconfigured. **Dropping that flag restores the
fail-open.**

## Never prove either config by exit code

`jscpd … -t 0` exits **1 in both states** on this repo:

| State | Result |
|---|---|
| healthy | 1 clone in 211 files |
| silently unconfigured | 16 clones in 312 files |

The exit code cannot tell them apart — **the analysed file count is the only signal.**

Prove a config change by effect, one of:

1. Check the **analysed file count** still excludes the ignored paths.
2. Plant a throwaway clone pair inside an ignored path and another outside; confirm only the
   outside pair is reported.

## Why placement is a pre-commit gate, not just CI

A misplaced file caught in CI becomes a follow-up ticket written after the session that produced
it has ended. Caught pre-commit, it is fixed by whoever still has the context.

The `PreToolUse(Write)` hook (`scripts/placement-guard.mjs`) pushes that one step earlier still —
it denies the file's creation before anything imports it. It shares its root-pattern derivation
with the gate, so the two cannot drift.

## Why ADR-0021 made every module declare an entry

The predecessor gate guarded **one hardcoded path**, so every module added after it was silently
exempt — and flattened. Requiring every module to declare what may sit loose at its root, and
FAILING a module with no entry, is what closes that.
