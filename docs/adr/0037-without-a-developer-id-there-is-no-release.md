# 0037 · Without a Developer ID there is no release, only a build from source

Status: proposed (#1864) · 2026-09-09

Binding on `apps/desktop` distribution while
[Provision the signing certificate, the notarization key and the release Environment](https://github.com/milad-alizadeh/argo/issues/1817)
is open. It leaves [ADR-0036](./0036-a-release-publishes-only-on-a-verdict-that-names-its-bytes.md)
standing in full: it removes no requirement and relaxes no condition. What it settles is the gap
ADR-0036 does not speak to — what happens to distribution in the meantime, which
[the migration spec](https://github.com/milad-alizadeh/argo/issues/1824) records as still
undecided.

**It is proposed, not accepted.** One line from the user naming the decision below turns it
accepted; until then nothing may cite it as approval for shipping anything.

## Context

**The release path is built and cannot run.** `release.yml` signs from the environment, so it
reaches its notarization step only once #1817 delivers the certificate, the App Store Connect key
and the `release` Environment. None of them exists. ADR-0036's publish condition refuses anything
that is not `signed: true, notarized: true`, so the workflow is not blocked by an oversight — it is
blocked by the gate working.

**"Unsigned" is not one thing.** `forge.config.ts` adds `osxSign` only when
`ARGO_SIGNING_IDENTITY` is set, which `release.yml` feeds from the `MACOS_SIGNING_IDENTITY` secret,
and it sets `resetAdHocDarwinSignature` for `darwin && !osxSign`. So a package built on a Mac
without an identity carries an **ad-hoc** signature — real, with no certificate and no team behind
it — while the same package built on Linux carries none at all, because that re-signature shells
out to `codesign`. `signing-readback.mjs` calls neither of them signed: its `signed` boolean
requires a Developer ID authority.

**Gatekeeper rejects the better of those two.** Measured on this machine, macOS 26.5.1 (build
25F80), 2026-09-09, against a minimal ad-hoc signed `.app`:

```
codesign -dv   →  CodeDirectory … flags=0x2(adhoc) · Signature=adhoc · TeamIdentifier=not set
spctl -a -vvv -t exec  →  rejected
```

`spctl` is the assessment a quarantined download gets on first launch. A locally built app is a
different case, and the difference is not the signature: the quarantine attribute is written by
whatever downloaded the file, so an app that was never downloaded is never assessed.

**Auto-update needs a signature too.** Electron's `autoUpdater` documentation: *"Your application
must be signed for automatic updates on macOS. This is a requirement of `Squirrel.Mac`."* So the
updater is unreachable for either build before `update.electronjs.org` is even asked, and
ADR-0036's asset rules never come into play.

**An ad-hoc build also carries no entitlements.** The set #1771 chose is applied through
`osxSign.optionsForFile`, which exists only when the identity does. There is nothing to read back,
and `release-assertions.mjs` says so rather than reading: with `signed` false, its entitlements
assertion returns `ran: false` and the failure `the app is not signed`.

**Nothing built leaves CI today.** Neither `ci.yml` job uploads an artifact. The macOS job
packages, asserts and runs the app, and the bytes die with the runner.

## Decision

**While #1817 is open, Argo publishes no desktop artifact. Building from this repository is the
only supported way to run the Electron cockpit.**

1. **No release, and no artifact outside a release either.** `release.yml` stays dispatch-only and
   stays unable to pass.
2. **Building from source is the distribution**, by the steps `apps/desktop/README.md` already
   carries. The result has no `com.apple.quarantine`, so it launches with no Gatekeeper
   instruction — which is the point: this option asks nobody to strip a protection.
3. **Gatekeeper and update behaviour are therefore both "not applicable".** There is no download to
   assess and no feed to check. The first honest reading of either arrives with the first signed
   release.
4. **ADR-0036 stands, unamended.** No existing signed-release requirement is changed, waived or
   scoped down here.
5. **A packaged build is described by what it is** — *packaged, ad-hoc signed* on a Mac,
   *packaged, unsigned* on Linux, and never *signed*. Its verdict carries `signed: false`,
   `notarized: false` and an entitlements assertion that did not run, so **entitlement evidence
   begins with the first Developer ID build**; until then the only entitlement statement Argo can
   make is the chosen set in `docs/research/2026-09-09-electron-app-entitlements.md`, which is a
   decision rather than a read-back. The fuse wire, the package manifest and the packaged-PTY run
   do prove something, and what they prove is the **package**. Such a verdict is not attached to a
   GitHub Release, not renamed, and not cited as release approval.
6. **This decision provisions nothing.** No membership, no secret, no publish, and no bypass of the
   verdict.

## Alternatives

- **Publish the ad-hoc build on GitHub Releases with a quarantine bypass.** Refused. It contradicts
  ADR-0036's publish condition outright; Gatekeeper rejects the artifact (measured above), so the
  instructions would have to teach `xattr -d com.apple.quarantine`, which removes the only check
  standing between the user and any later artifact; the updater still cannot run; and under
  immutable releases every withdrawal burns its tag name forever.
- **Publish it somewhere other than a release** — an issue attachment, a branch, a bucket. Refused
  for the same Gatekeeper and updater answers, and it strands the bytes with no verdict beside
  them, which is the exact absence ADR-0036 exists to make impossible.
- **A self-signed certificate.** Refused. Gatekeeper trusts Developer ID certificates issued by
  Apple; a self-signed leaf assesses no better than the ad-hoc signature.
- **Buy the membership now.** Out of this ticket's scope by its own terms, and #1817 owns it.

## Consequences

- **Only people who can build the repository can run the cockpit.** Any acceptance evidence
  [the cutover](https://github.com/milad-alizadeh/argo/issues/1737) needs comes from a local build
  until #1817 closes, and a local build cannot stand in for the signed one that decision names.
- **The update path stays unexercised end to end.** Nothing here proves it; the first signed
  release is its first reading.
- **Wanting a shared artifact before #1817 closes means contradicting this file**, in the open,
  rather than editing a workflow quietly.
- **#1817 closing supersedes this ADR** rather than amending it: the ordinary release path becomes
  reachable and nothing above has anything left to govern.
