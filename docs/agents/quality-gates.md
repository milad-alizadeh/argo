# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Quality gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the config that **fails silently open**, and how to prove a
change to it.

## What runs where

One place, and it is CI. `.github/workflows/ci.yml` runs three steps on `ubuntu-latest`:

- `bun run format-and-lint` — biome, `--error-on-warnings`.
- `bun run quality:duplication` — jscpd, whole-tree, because a linter reads one file at a time.
- `bun run test:hooks` — every `scripts/*.test.mjs`, discovered from the directory.

Nothing runs at push time. `.husky/pre-commit` still runs lint-staged; `.husky/pre-push` is gone.

## What used to be here, and why it is not (#1758)

Most of this file described `scripts/swift-gate.sh` and the machinery it needed: the verdict cache
keyed on the Swift tree, the machine-wide build-slot lock, the package-scope narrowing, the
two-phase timing split, the `ARGO_GATE_CALLER` column and `bun run gate:report`. All of it is
deleted, along with `apps/macOS/scripts`, because `apps/macOS` is deprecated in favour of the
Electron app and there is no Swift tree left worth gating.

Two things worth carrying forward when `apps/desktop` needs a gate of its own, because both were
learned the expensive way:

- **A gate is priced per tree, and a review changes the tree.** Verifying before the review buys
  bytes nobody ships.
- **A ratio gate passes by dilution.** jscpd goes green when un-cloned lines are added around a
  clone, so read the clone count, not the percentage.

The cost premise that started it, that a `macos-26` CI job "billed about 99% of this repo's Actions
spend", was a misreading of the gross column. The billed column was $0. See the header of
`.github/workflows/ci.yml`.

## Where an exemption goes

Exemptions live in **two** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |

Two rules have no linter and live in `rules/house.md` prose only: a cast standing in for a
check, and the exhaustive construct over a closed set.

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

## Never prove the config by exit code

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

