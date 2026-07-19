---
paths:
  - "**/package.json"
  - "**/bun.lock"
---

# Dependency Hygiene

Prefer a well-maintained library over bespoke logic for any **solved problem** —
cryptography, auth, date/time, HTTP, parsing, encoding (base64/JSON), schema
validation, UI primitives. Hand-rolled versions of these are bugs waiting to
happen; do not reinvent them.

- **Never hand-edit the lockfile or hand-write a version.** Add, upgrade, or remove
  packages by running `{{PKG_ADD}}` / `{{PKG_REMOVE}}` **from the repo root**. This
  is a `{{PKG_MANAGER}}` workspaces monorepo (`apps/*`, `packages/*`) — never run
  install inside a single workspace, so the single root lockfile stays authoritative.
- **Vet before adding:** is it maintained (recent releases, open-issue health),
  reasonably sized, and licence-compatible? Prefer the option the ecosystem already
  standardised on over a novel one.
- **Don't add a dependency for a few lines** you can write clearly yourself, and
  don't keep one you no longer use — prune dead dependencies.
