---
paths:
  - "{{MANIFEST}}"
  - "{{LOCKFILE}}"
---

# Dependency Hygiene

Prefer a well-maintained library over bespoke logic for any **solved problem** —
cryptography, auth, date/time, HTTP, parsing, encoding (base64/JSON), schema
validation, UI primitives. Hand-rolled versions of these are bugs waiting to
happen; do not reinvent them.

- **Never hand-edit the lockfile or hand-write a version.** Add, upgrade, or remove packages
  by running `{{PKG_ADD}}` / `{{PKG_REMOVE}}` — the lockfile is generated output, and a
  hand-written version pins something the resolver never checked.
- {{WORKSPACE_NOTE}}
- **Vet before adding:** is it maintained (recent releases, open-issue health),
  reasonably sized, and licence-compatible? Prefer the option the ecosystem already
  standardised on over a novel one.
- **Don't add a dependency for a few lines** you can write clearly yourself, and
  don't keep one you no longer use — prune dead dependencies.
