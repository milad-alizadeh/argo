# 0036 · A release publishes only on a verdict that names its bytes

Status: accepted (#1805) · 2026-09-09 · supersedes the draft-until-checks clause of #1746

Binding on the `apps/desktop` release path, which does not exist yet: this is the contract it is
built to. It **supersedes the draft-until-checks clause** of
[Define the desktop update experience](https://github.com/milad-alizadeh/argo/issues/1746), which
described a hand-publish flow this removes. The rest of #1746 stands — only the mechanism changed,
and the replacement is a stronger form of the same intent.

Nothing here is a new decision. The release path, the verdict and the manifest were settled in
[Decide what refuses a desktop publish, and what the artifact check asserts](https://github.com/milad-alizadeh/argo/issues/1788);
the backstop was rebuilt in
[Choose the backstop that replaces the impossible draft revert](https://github.com/milad-alizadeh/argo/issues/1809)
after [Prove whether an immutable release can be reverted to draft](https://github.com/milad-alizadeh/argo/issues/1804)
proved the first design impossible. This file is where the repo keeps the answer, for the reason
[ADR-0033](./0033-dom-geometry-is-settled-before-it-is-shown.md) exists: a live contract does not
stay a comment on a closed issue.

One ADR rather than two. The manifest is only meaningful as the thing the verdict asserts; split
apart, each half reads as a rule with no reason.

## Context

**No GitHub mechanism gates a release publish.** This is the load-bearing fact, because every
alternative design assumes a gate that does not exist. Each of these was checked against GitHub's
own documentation — `available-rules-for-rulesets`, `about-releases`, `immutable-releases`,
`use-artifact-attestations` and `secure-use` — and came back negative:

- **Rulesets** target refs. Their rule list never mentions releases.
- **Required status checks** gate a change to a protected branch. A publish is not a ref change.
- **Classic tag protection** is sunset.
- **Environment protection rules** gate a deployment job, never a release.
- **Permission is the whole control.** Only people with write permission can manage releases, and
  there is no approval feature for publishing anywhere.
- **A tag ruleset makes it worse, not better.** A tag ruleset *does* apply to `GITHUB_TOKEN`, and
  GitHub Actions cannot be granted a bypass on a personal repository — the API answers `Actor
  GitHub Actions integration must be part of the ruleset source or owner organization`, while a
  `RepositoryRole` bypass for the repository admin does work. The bypass follows the human, not the
  token. So a ruleset would block the release workflow and leave hand-publishing open, which is the
  opposite of the intent. Measured on a throwaway repository under #1804; a reader who does not
  know this will propose a ruleset.

Prevention is therefore not on the table. What is left is a positive artifact, because **a job that
never started is green in exactly the same way as one that was never required.**

**A draft is worth something the documentation does not promise.** `update.electronjs.org` does not
use `/releases/latest`. It lists releases and filters them itself, in `src/updates.ts`:

```js
if (!semver.valid(release.tag_name) || release.draft || release.prerelease) { continue; }
```

A draft is invisible to the updater, with no exposure window at all. That makes
draft-until-verified strictly better than publish-then-revert, and it is the shape chosen.

## Decision

**The release workflow owns the whole path, and it publishes only on a passing release verdict.**
The verdict is one JSON document, written by one job, holding every assertion any tier makes about
the build, keyed to the SHA-256 of every artifact it judged. Nobody hand-publishes a draft, because
under this flow no draft is ever waiting for a human.

A `release: [published]` handler is the backstop, and it is a compensating action rather than a
prevention: it files an issue carrying the evidence, then **deletes** any release that does not
carry a passing verdict.

## Rules

1. **A release starts as a `workflow_dispatch` with a version input, never a tag push.** A tag is
   permanent, and a failed build would leave one pointing at bytes that never shipped. Dispatch
   first means the repository only ever carries tags that have a passing verdict. The workflow
   builds, verifies, creates the release, attaches the artifacts and the verdict, and publishes
   when the verdict passes.

   **A draft creates no tag** — that is the mechanism behind the guarantee, and it is measured
   (#1804): a draft on a tag that does not exist is accepted and the ref appears only at publish.
   So the workflow builds into a draft, and the tag comes into being in the same call that the
   passing verdict authorises.

2. **A failed verification leaves nothing behind**: no tag, no release, no assets. The failing
   verdict goes to the job summary and a workflow artifact, and the workflow run is the permanent
   record. A draft that exists to record a failure is a draft somebody can publish, which is the
   hole this ADR closes.

3. **One verdict per release, not one per artifact.** One release is one build of one app, and the
   DMG and the ZIP are containers of the same bytes; separate sidecars would let two of three be
   present and read as complete. The hash list is what stops a verdict being inherited: an asset
   whose SHA-256 is not in the list is an asset the verdict does not cover.

   It is called `release-verdict.json` and it is a release asset, so it travels with the artifacts
   it judges. The name does not collide with `Check`, `Outcome` or `Gate` in `CONTEXT.md`, which
   are cockpit vocabulary and mean something specific there, and it does not collide with the
   provenance attestation riding beside it.

4. **One document, every assertion.** The fuse wire (#1757), the entitlements read-back (#1771),
   the packaged PTY proof (#1769) and the package manifest (#1806) all write into it. "The check
   never ran" is then a single missing file rather than an absence somebody has to know to look
   for, and an assertion added later cannot silently fail to be required.

5. **`signed` and `notarized` are explicit booleans.** A build that cannot sign still produces a
   verdict, with `signed: false`. A fork pull request receives no secrets other than
   `GITHUB_TOKEN`, so it can package and read the fuse wire back but cannot sign, and the release
   path refuses anything that is not `signed: true, notarized: true`. A verdict that records what
   it could not assert is worth more than a silence, and it makes the fork case a *different*
   verdict rather than an *absent* one.

6. **The verdict is backed by a build provenance attestation** (`actions/attest-build-provenance`).
   This is what makes the fork boundary structural rather than conventional: `attestations: write`
   is not grantable on a fork pull request run, the certificate SAN carries the producing workflow
   ref, and nothing persists to the attestation store from a fork. **Verification pins the
   producer**: `gh attestation verify` with `--signer-workflow` and `--source-ref`, never `--repo`
   alone, which answers only "some workflow in this repository".

7. **Immutable releases are on, from the first release.** They make the verdict's hash list
   permanently true rather than true-at-the-time. What that costs and permits is measured, not
   assumed (#1804):

   - Editable after publish: title, release notes, `prerelease`, `make_latest`.
   - Refused after publish: `tag_name`, and `draft` — `PATCH /repos/{owner}/{repo}/releases/{id}`
     with `draft: true` returns 422, `state cannot be changed when release is immutable`.
   - `DELETE /repos/{owner}/{repo}/releases/{id}` returns 204 and is the only removal GitHub
     allows. Assets cannot be uploaded to a published immutable release (422, `Cannot upload
     assets to an immutable release.`) or deleted from one (422, `Cannot delete asset from an
     immutable release`), so asset-level tampering is closed.
   - **Publishing generates a release attestation**, verifiable with `gh release verify <tag>`.
     That is GitHub attesting the release; rule 6's provenance attestation is Argo attesting the
     build. Both are needed, because only the second names the workflow that produced the bytes.
   - **A delete spends the version number permanently.** The git tag ref survives the delete, a new
     release on that name is refused with `tag_name was used by an immutable release`, and deleting
     the tag ref does not free it.
   - **The repository setting is in no API.** `PATCH /repos/{owner}/{repo}` with
     `immutable_releases=true` returns 200 and silently ignores the field, GraphQL has no field for
     it, and no ruleset type covers it. It is turned on by hand in Settings → General → Releases.
     A workflow that must know the state reads the per-release `immutable` boolean, never the
     repository.
   - The draft-then-publish path works: a draft reports `immutable: false` and takes asset uploads,
     and `PATCH draft=false` flips it in one call. The feed's draft skip makes the staging
     invisible, so the release appears complete or not at all.

8. **The verdict asserts the updater's asset shape.** Squirrel.Mac installs ZIP updates only, and
   `update.electronjs.org` matches `/.*-(mac|darwin|osx).*\.zip$/i` with an optional `-arm64`,
   `-x64` or `-universal` suffix. The DMG is the human download; the ZIP is the update channel. A
   renamed asset is the one failure in this whole set that is completely silent: everything signs,
   everything verifies, the release publishes, and users simply never receive an update.

9. **The package check is the exact set, not presence.** Presence catches the file you forgot; the
   exact set also catches the file you did not mean to ship, which is the failure this repository
   has actually hit — #1743 found Forge's dependency walker hard to predict and #1791 turned
   pruning off entirely, so a sourcemap, a dev dependency or a signing artifact arrives with nobody
   editing a file.

   One checked-in JSON, `apps/desktop/package-manifest.json`, with three named arrays: `asar`,
   `unpacked`, `extraResources`. Three arrays because the three places a file can arrive are read
   three different ways, and named ones because a missing array must fail as loudly as a missing
   file. The schema check is separate from the comparison.

   Comparison runs over a **normalised** entry list: a rollup content hash under `.vite/` collapses
   to `-[hash]`, and everything else — `node_modules`, the unpacked tree and the extra resources —
   compares literally, because that is where an unwanted file actually arrives. **The normalisation
   rule is code in the generator, never data in the file**, so the checked-in file stays a plain
   sorted list a reviewer can read.

   **It is regenerated by hand and reviewed as a diff.** `bun run desktop:manifest --write`
   regenerates it from a packaged app, the file is committed, and CI fails when the packaged set
   differs in either direction. Regenerating it automatically on merge makes the gate agree with
   whatever shipped, which is the shape of a gate that never fires.

   It runs in the Linux tier on **every** pull request with no path filter: the likeliest
   regression is a lockfile refresh, and a dependency bump may touch no `apps/desktop` file at all.
   The cheap tier can do this because Forge packages darwin arm64 on Linux — it cannot sign,
   notarize or build the DMG there, but the asar entry list is plain JavaScript over the built app.
   #1806 found what that costs: `@electron/fuses` re-signs an ad-hoc arm64 bundle through
   `codesign`, so the plugin's `resetAdHocDarwinSignature` is narrowed to a darwin build host.

   The macOS tier re-reads the same manifest off the app it packages, because signing adds files
   and the shipped bytes are the ones that matter. Until `osxSign` is configured (#1771) nothing is
   signed and the two readings agree; the tier exists for the reading it will take afterwards.

   In the release path the result is **one assertion inside the verdict**, not a standalone pass or
   fail. On a pull request today it is standalone, because nothing collects it yet: the collector
   is the release workflow (#1807).

10. **The signing identity lives in a GitHub Environment** used only by the release workflow, not
    in plain repository secrets that any workflow file a pull request adds could read. Environments
    are available on Free for public repositories.

## The backstop deletes, and it files first

The handler on `release: [published]` fires only when a release exists that the gate should never
have produced, so its output is evidence of a process failure. Order matters, because the delete
destroys the evidence:

1. Read `release-verdict.json` off the release.
2. **File a GitHub issue**, labelled `bug` and `ready-for-human`. It names which of the two cases
   it hit, verdict missing or verdict failing, and carries the release id, the tag name now burned,
   the SHA-256 set out of the verdict, and the verdict document itself when there was one.
3. `DELETE` the release.
4. Write the same into the job summary.

It needs `contents: write` and `issues: write`. There is no loop risk: an event triggered by
`GITHUB_TOKEN` starts no new workflow run.

**The issue is the load-bearing half, not the delete.** A staged update cannot be recalled at all:
once a client has emitted `update-downloaded`, the install path touches no network — Squirrel
writes `ShipItState.plist` and installs from the local bundle, and it deliberately preserves the
staged update across later checks. The only remedy is publishing a higher version, and the filed
issue is what makes somebody cut one. A job summary on a run nobody is watching is invisible.

**Marking is refused, and delete strictly dominates it.** Flipping `prerelease: true` does take a
release off the feed, by the same filter quoted above. But it leaves the bad bytes on a URL that
still serves them, while delete takes the release off the feed in the same time *and* removes the
bytes. There is no timing argument for doing both, because both are bounded by the same cache. A
release note saying "withdrawn" is read by a person, not by Squirrel.

**The retraction window is the feed's cache, about 15 minutes.** `CACHE_TTL` defaults to `15m`, the
key is per repository and holds every platform together, and the live service sends no
`Cache-Control` and sits behind no CDN. Inside that window the feed still hands out a deleted
release's download URL; Squirrel.Mac treats the 404 as a hard error, deletes the partial zip,
stages nothing and retries. That is a failed check, not a broken client. Two things follow for
whoever builds the handler: the feed never reads `make_latest` and never sorts by semver — it picks
the first non-draft, non-prerelease, semver-tagged release in GitHub's list order that carries a
matching asset — so "take `latest` away" was never a lever, and GitHub documents list ordering only
for *Get the latest release*.

**The cost accepted is the burned version number.** `v1.2.0` is gone and the retry is `v1.2.1`. The
version scheme tolerates gaps, and `/release-argo` (#1808) reads the existing tags and proposes the
next unused patch, so a retry after a burn is arithmetic rather than a rule somebody has to
remember. A version number is cheap; a downloadable release carrying a failing verdict is not.

**Two different failures share one message.** A tag name burned by an immutable release and a tag
ruleset restricting creation both return `pre_receive Repository rule violations found ... Cannot
create ref due to creations being restricted.` The burned-name case shows no ruleset in
`GET /repos/{owner}/{repo}/rulesets`, which returns `[]`. A release workflow that reports this
error must say which case it hit, or the next reader looks for a ruleset that does not exist.

## No required reviewer

A GitHub Environment with a required reviewer is the one prevention that actually works, and it is
refused. A human clicking approve checks nothing the job has not already checked, and would be
reading the verdict out of a job summary rather than having it read for them. The steady state is a
rubber stamp that also makes every release wait for somebody to be awake. The gate stays automatic;
the backstop covers the case where the gate itself was broken or bypassed, which is a process
failure and not a normal path.

## What this does not settle

- **The release workflow itself.** Its jobs, its inputs and its wiring are
  [Publish a desktop release only on a passing release verdict](https://github.com/milad-alizadeh/argo/issues/1807).
- **The verdict's schema, field by field.** The rules above say what it must carry and what must be
  a boolean; the document's shape is written once, with #1807, and every later assertion is added
  to it rather than beside it.
- **Where the release notes come from.** They are a committed `CHANGELOG.md` entry the workflow
  reads for the version it is building, drafted by `/release-argo`
  ([#1808](https://github.com/milad-alizadeh/argo/issues/1808)), which pushes nothing. That the
  notes are tracked rather than typed at dispatch is what lets a release be rebuilt without
  retyping them.
- **Windows and Linux.** The asset-shape rule above is the macOS ZIP. The other platforms have no
  package, no signing and no update path yet.

## Consequences

- **The verdict schema becomes what every later check writes into.** Adding an assertion is adding
  a field to one document and a line to the publish condition. That is the reversal cost: a check
  that reports beside the verdict is a check the release path does not read.
- **A fork pull request can package, read the fuse wire back and check the manifest, and cannot
  sign.** Its verdict is a real document with `signed: false`, and the release path refuses it.
- **Every removal costs a version number**, so the tag sequence has gaps and nothing may read it as
  a count.
- **Release immutability is a hand-set repository setting that no gate can assert.** The only
  assertable form is the per-release `immutable` boolean, so a workflow checks the release it just
  made rather than the repository it made it in.
- **The manifest is a file a human reviews.** A dependency bump that changes the package will fail
  CI on a pull request that touched no `apps/desktop` file, and the fix is to regenerate and read
  the diff. That is the gate working.
- `apps/macOS` is not covered. It is deprecated, gated by nothing, and has no release path of its
  own to supersede.
