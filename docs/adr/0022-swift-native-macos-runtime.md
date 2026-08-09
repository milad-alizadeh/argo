# ADR-0022 — Swift-native macOS runtime replaces Electron

**Status:** Accepted — superseded ADR-0002 (electron-desktop-runtime), since deleted along with
0004, 0005 and 0006 by [ADR-0023](./0023-the-electron-runtime-is-retired.md), which records the
migration's final step

## Context

The cockpit reskin (#373) requires a first-class macOS shell: a real AppKit
sidebar (native selection, focus, keyboard, accessibility), Liquid Glass on
macOS 26 with native material fallback on older versions, and native window
behavior throughout. Electron cannot host a genuine AppKit view hierarchy
inside its Chromium content area — CSS imitations of native material were
already ruled out by #373 itself.

Alternatives considered:

- **Electron + bounded native views** — can fake material via vibrancy, but
  the sidebar would remain React painted over native material; compositor,
  input routing, and accessibility-tree integration of embedded AppKit views
  is not practically achievable.
- **React Native macOS / Expo Desktop** — renders native views but provides
  none of the AppKit shell idioms (NSSplitViewController, source lists,
  NSToolbar, menu/responder chain); those would all be custom native modules.
  The existing renderer is React **DOM** (xterm.js, Radix, shiki, CSS), which
  does not port to RN — rewrite-level cost for a middle ceiling, on top of a
  community-maintained fork.
- **Swift shell + WKWebView content** — native shell fidelity while keeping
  the React renderer. Rejected because Argo has a single user (the author),
  no live deployment, and an explicit goal of learning Swift; preserving the
  web renderer preserves the wrong asset.

## Decision

Rewrite the desktop app as a pure Swift macOS application at `apps/macOS`.
SwiftUI-first for room interiors; AppKit where fidelity demands it (sidebar,
window chrome, material). Liquid Glass (`NSGlassEffectView`) on macOS 26+,
`NSVisualEffectView` on older supported versions — never a renderer-drawn
imitation.

Migration is **parallel-until-parity in vertical slices**
(shell → Sessions → Dock/terminal → Work → Code → delete `apps/desktop`).
The Electron app is frozen (no new features) and serves as a reference
implementation only — it has no users to migrate. Each slice doubles as a
Swift/SwiftUI/AppKit learning module for the author.

## Consequences

- Windows/Linux portability is abandoned by design.
- The ~23k-LOC React renderer and ~8.4k-LOC Node main process are ported,
  not reused; the domain model, ADR trail, and CONTEXT.md carry over intact.
- xterm.js/node-pty are replaced by a native terminal path (decided
  separately).
- The toolchain decisions in ADR-0006 no longer apply to the desktop app — that ADR was
  deleted outright once the app was (ADR-0023).
