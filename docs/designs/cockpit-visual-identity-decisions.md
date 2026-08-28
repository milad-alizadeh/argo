# Cockpit visual identity replacement — decision log

Decision record for the visual-direction grill begun and locked on 2026-08-06. This direction
replaces the cockpit's visual identity without redesigning its information architecture or
interaction model. Existing screen specifications remain authoritative for UX; this document and
its approved study are authoritative for the replacement look and feel.

> **Direction locked — 2026-08-06:**
> [`cockpit-sessions-liquid-glass.png`](cockpit-sessions-liquid-glass.png) is the approved visual
> study for the replacement identity. Decisions D1–D46 are the implementation brief. Reopening a
> locked choice requires an explicit new design decision; implementation should resolve rendering
> details through tokens and components rather than treating pixels or generated text as code.

> **Native-runtime correction — 2026-08-07:**
> [ADR-0022](../adr/0022-swift-native-macos-runtime.md) replaces the earlier Electron integration
> posture with a pure Swift 6 and SwiftUI application targeting macOS 26 only. The visual decisions
> remain intact; their implementation is native `NavigationSplitView`, `List`, toolbar, Liquid
> Glass, focus, keyboard, and accessibility behaviour. There is no renderer bridge, compatibility
> theme, pre-macOS-26 fallback, or `#available` branch.

> **Source-of-truth correction — 2026-08-06:** Visual studies must begin from the current implemented
> `RealSession` screen, not the retired session-interior HTML prototype. Current Activity is an
> Agents rail beside one chronological feed and its density gutter; it has no Timeline/detail
> navigation. The first generated concept in this grill used the retired prototype and is rejected.

## D1 — App-wide identity, proved on Sessions first

- **Decision:** Replace the visual identity of the whole cockpit. Use the existing Sessions room as
  the proving ground, then carry the approved system through the shell, Work room, and Code room.
- **Why:** Penumbra is embedded in the shared token contract, scene, and surface recipes. Styling
  Sessions as an isolated theme would create two competing systems and conceal whether the new
  direction can support the rest of the product.
- **Boundary:** Preserve the existing UX, information hierarchy, component responsibilities, and
  interaction model unless a visual experiment reveals a concrete legibility problem. The first
  pass is a reskin, not a product redesign.
- **Consequence:** The approved Sessions study exercises the reusable foundations—type, colour,
  material, elevation, state, and motion—rather than solving only that screen. It is now the visual
  target for the app-wide replacement. Penumbra remains historical provenance and a description of
  the code that has not yet migrated, not the target identity.

## D2 — Native material, art-directed by Argo

- **Decision:** Use native macOS Liquid Glass for the shell regions that earn material. Argo
  art-directs the content above it through semantic colour, typography, state, geometry, and
  motion; it does not repaint or imitate the substrate.
- **Why:** Native material supplies the environmental response, focus behaviour, accessibility,
  and platform evolution that make the application feel genuinely macOS. Argo's identity comes
  from disciplined placement and content treatment rather than replacing that material with a
  branded acrylic approximation.
- **Boundary:** Glass is a shell material, not a content treatment. Dense working surfaces paint an
  opaque background over it. Any proposed transparent region that fails contrast under light and
  dark wallpapers, focused and unfocused windows, or Reduce Transparency becomes solid.
- **Material correction:** The native substrate remains neutral and system-derived. Argo must not
  paint a blue-grey acrylic fill over it or use Ion Blue as a glass tint; Ion Blue belongs to
  focus, selection, and optical response. A restrained foreground treatment may stabilise content
  contrast, but it must not conceal or pretend to create the native material.
- **Technical posture:** SwiftUI owns the window, split navigation, sidebar, toolbar, controls,
  focus, and Liquid Glass on macOS 26. Prefer native components and modifiers; extend them only
  where the locked Argo identity needs custom content or drawing. ADR-0022 permits AppKit interop
  only for the later SwiftTerm terminal surface, not for shell material.

## D3 — Native vertical sidebar, separate glass control islands

- **Decision:** The project strip and outer Sessions roster form one continuous vertical sidebar
  using native macOS sidebar vibrancy. The opaque Instrument Deck begins at a straight material
  boundary to its right. The top chrome is not an L-shaped extension of the sidebar: room, git, and
  other top controls sit in separate glass islands over the Deck.
- **Why:** Native macOS references keep the sidebar neutral and environmental while giving important
  controls their own luminous containers. A connected blue-grey canopy would read as tinted acrylic
  rather than system material and would flatten the distinction between navigation and controls.
- **Supersedes:** Penumbra's rule that the roster sits outside the glass while the Session plane is
  the one frosted surface, and this grill's earlier continuous L-shaped canopy proposal. Glass now
  identifies the native navigation layer; the working plane remains solid.
- **Boundary:** Sidebar rows stay flat and crisp over the material, with a restrained selection wash.
  The native material carries no Ion Blue tint. Project navigation, roster behaviour, chrome
  contents, and workspace responsibilities retain their existing UX.
- **Native implementation (binding):** The sidebar **is** system Liquid Glass, drawn by macOS 26 —
  it is never an approximated dark fill. Concretely: the sidebar column of `NavigationSplitView`
  paints **no** background of its own, and neither does the window or any ancestor of it; the
  Sessions roster uses `.listStyle(.sidebar)` so `List` inherits the system material; the project
  strip shares that same column so the material runs uninterrupted behind both. Nothing in the
  sidebar subtree may call `argoDeckSurface` or set an opaque `background` — that modifier belongs
  to the Instrument Deck, which is opaque by contract. A single flat graphite plane behind the
  roster is a **defect**, not a neutral substitute.
- **How to verify:** Glass is only visible against something. Screenshot the running window over a
  non-uniform desktop wallpaper and move the window; the sidebar must pick up the backdrop and
  respond to focus (key vs inactive). A screenshot taken against a black or solid desktop proves
  nothing and does not close a roster or shell ticket.

## D4 — Dark-first, not dark-locked

- **Decision:** Design and validate one exceptional dark cockpit first. Keep the token roles capable
  of supporting another theme, but do not split the replacement study across dark and light modes.
- **Why:** The running app already presents a dark cockpit, and material, contrast, typography, and
  dense hierarchy need to be judged together. Simultaneously art-directing two identities would
  dilute the proving pass before either one reaches the required finish.
- **Consequence:** The Sessions study and its visual verification target dark mode. A future light
  interpretation must be designed as a deliberate translation of the settled system, not generated
  by mechanically inverting its colours.

## D5 — Identity colour and status colour are separate systems

- **Decision:** Brand and interaction colour communicates selection, focus, active controls, and
  Argo's signature lighting. Operational colours communicate Session and Delivery state only.
- **Why:** Penumbra makes Eclipse gold both the product accent and `needs you`, causing decorative
  emphasis, selection, and operational attention to compete in one channel. Separation lets the
  interface establish an identity without making the entire cockpit look alert.
- **Consequence:** Replacing the identity hue must not silently change the status vocabulary. Each
  status colour will be judged for semantic clarity and accessibility independently, and brand
  colour will not be used as a generic attention treatment.

## D6 — Ion Blue is the identity light

- **Decision:** Argo's proposed identity accent is **Ion Blue**: a cool electric
  periwinkle/cobalt core with a restrained violet fringe where light appears to refract through
  glass. Exact values remain proposals until validated in the Sessions study.
- **Usage:** Apply the flat core colour to selection, keyboard focus, active controls, and active
  navigation. Reserve the chromatic blue-to-violet fringe for the canopy/workspace seam and the
  orchestrated active-Session transition—never generic gradient buttons or glowing cards.
- **Why:** This preserves the cool precision that makes Raycast and Linear relevant references while
  grounding the colour in Argo's glass instrument metaphor. Restricting the spectral treatment to
  an optical edge keeps it from becoming a generic purple SaaS theme.

## D7 — Warmth is semantic, never atmospheric

- **Decision:** Retain amber exclusively for the operational `needs you` signal. Running uses cool
  cyan, failure uses red/coral, and idle or complete states use slate. These colours remain
  independent of Ion Blue.
- **Boundary:** Amber may appear on the small status dot or an equally compact state-bearing icon or
  word. It may not tint a plane, illuminate the canopy, indicate selection, colour an ordinary
  action, or become decorative atmosphere.
- **Why:** A tiny, conventional warm signal remains quickly distinguishable from cool selection and
  red failure. Strictly limiting its area preserves that semantic advantage without allowing the
  rejected gold identity to return through the status system.

## D8 — Three typographic voices

- **Decision:** Replace the all-purpose Inter posture with three restrained roles: a native macOS UI
  face for controls and dense reading, an identity face for Session titles and rare major headings,
  and a machine mono for branches, commands, telemetry, diffs, and terminal-adjacent facts.
- **Why:** Human intent, interface language, and machine state are different information classes.
  Giving each a controlled voice improves hierarchy without adding containers or changing the UX.
- **Boundary:** Typography remains quiet at cockpit density. The identity face is not used for body
  copy or every label, and the mono face does not become a decorative techno motif. Exact faces and
  metrics are settled by rendered comparison inside the Sessions study.
- **Amended by [#502](https://github.com/milad-alizadeh/argo/issues/502) — 2026-08-10:** that
  settlement landed on two faces, not three — see D24. The identity role is SF Pro at its own rung
  and weight rather than a separate family, so this entry stands as the reasoning and D24 as the
  faces.

## D9 — Geometry is part of the reskin

- **Decision:** The replacement may change spacing, row heights, radii, border weight, icon size,
  split proportions, and optical alignment through the shared token system while preserving the
  existing information architecture and behaviour.
- **Direction:** Use tighter navigation and metadata, deliberate breathing room around important
  content, smaller radii, fewer visible containers, hairline separation, and optically aligned text
  and icons. Density is composed by role rather than applied uniformly.
- **Why:** Penumbra's geometry is as recognisable as its colour and lighting. Keeping its generous
  rounded planes and cove spacing would leave the old identity intact beneath a new palette.
- **Boundary:** This does not authorise moving features, changing navigation, removing information,
  or introducing a new interaction model. Any such need returns to the grill as a separate UX
  decision.

## D10 — The current single-feed workspace is one Instrument Deck

- **Decision:** Render the Session header, Activity or Delivery content, Agents rail, single
  chronological feed, density gutter, and terminal Dock as zones within one continuous opaque
  graphite **Instrument Deck**, not as a stack of visibly separate cards.
- **Why:** A single machined working object is calmer at high density, avoids the document/card
  language associated with Attio and Notion, and creates a strong material contrast with the glass
  canopy surrounding it.
- **Structure:** Internal hierarchy comes from tonal steps, alignment, whitespace, and hairline
  seams. Rounded containers are reserved for elements that genuinely float, detach, or accept a
  direct interaction; they are not the default way to group information.
- **Boundary:** Existing Session header, tabs, Agent selection, single-feed behaviour, density
  navigation, and Dock responsibilities remain intact. This changes their visual composition, not
  their interaction model; it does not reintroduce a Timeline or a second detail feed.
- **Amendment — the window's top zone is ONE chrome bar — 2026-08-12 (#671):** the toolbar band, the
  Session header and the tab line under it are a single bar, not three surfaces stacked. One
  material runs across all of it and there is exactly one hairline, at the foot. The reading passes
  beneath and blurs through. The zones with a header of their own — the Agents rail and the evidence
  panel — begin below the bar instead of passing under it, since a header behind a blur is a header
  nobody can read.
- **The material is a blur, not Liquid Glass.** A float is present BECAUSE the reader is in a state
  (D14), so its specular rim earns its keep. Chrome is always there, so the rim is decoration and
  the boundary is the only thing worth drawing. It is nonetheless implemented as untinted
  `glassEffect(.clear)` under a wash, because a SwiftUI `Material` and an `NSVisualEffectView` both
  sample only what SwiftUI drew and the feed is an `NSTableView` — under either, the reading stopped
  dead at the bar's edge. The glass is drawn taller than the bar and the surplus clipped, which
  removes the mirrored strip it refracts along its own bottom edge.
- **Why the amendment:** the two stacked opaque slots read as a grey box bolted to the top of the
  plane, and a canopy with its own material put a seam between the window's icons and the Session's
  title. Xcode's own toolbar is the reference: one bar, one rule under it, and the working surface
  apparently continuing past the chrome. This is the only place the deck borrows a translucent
  material — the plane behind it stays opaque graphite, so the contrast the original decision
  protects survives everywhere else.

## D11 — Material replaces the decorative scene

- **Decision:** Retire Penumbra's atmospheric room scene: no orb key-light, cove bloom, dust field,
  or decorative background illumination. The native canopy supplies environmental depth; the
  Instrument Deck supplies controlled near-black graphite.
- **Treatment:** A restrained cool tonal falloff and microscopic grain may prevent large solid
  regions from appearing digitally flat. These are material finishes, not a pictured environment.
  The decorative Concierge orb is absent until Concierge has a real action. If it returns, it is a
  compact control and does not light the whole room.
- **Why:** Environmental effects compete with dense operational information and would duplicate the
  depth already supplied by native glass. Removing them shifts the impression from themed backdrop
  to precisely manufactured instrument.

## D12 — Motion responds; it never performs ambiently

- **Decision:** Animate material only in response to a user action or a meaningful system state
  change. Glass does not continuously shimmer, wobble, drift, or follow the pointer.
- **Core response:** Changing the active Session may send one brief Ion Blue refraction along the
  canopy/deck seam. Hover and focus use small luminance changes; opening a floating surface uses a
  precise settle rather than a bounce. Reduced Motion preserves state clarity without refraction or
  scale.
- **Delight brief:** Add a small set of authored micro-interactions at high-value moments across the
  shell and Sessions room. Each must acknowledge an action, reveal structure, or make a state change
  legible; decoration alone does not earn motion.
- **Why:** A few repeatable, meaningful responses make the cockpit feel crafted. Continuous liquid
  animation would tax attention, cheapen the native material, and compete with genuinely live
  operational signals.
- **What may loop — [#614](https://github.com/milad-alizadeh/argo/issues/614) — 2026-08-11:** a
  **live operational signal** may loop for exactly as long as the operation it reports lasts, and it
  must stop when the operation stops. Nothing else loops. Two signals qualify today: what the feed
  draws while a Turn is in flight ([`cockpit-feed-working.md`](cockpit-feed-working.md)), and the
  system spinner while a spawning Session's login shell reports its `PATH`.
- **Why that is this rule, not a hole in it:** the reason above bans continuous animation because it
  would *compete with genuinely live operational signals*. A Turn in flight **is** that signal, so a
  loop reporting it competes with nothing — it is the thing the ban was protecting. What D12 forbids
  is ambient motion: motion with no operation under it, and therefore no moment it is obliged to
  end.
- **How to test a proposed loop:** name the operation, and name the event that ends it. A loop that
  cannot name both is ambient and D12 refuses it. A loop that outlives its operation is a defect
  rather than a style choice, because it goes on reporting work that has stopped.

## D13 — Delight has an optical-mechanical character

- **Decision:** Moments of delight behave like light passing through a precise instrument: focus,
  refraction, signal bloom, and mechanical latching. Avoid playful elasticity, particles, confetti,
  cursor-following effects, and ornamental celebration.
- **Named moments to study:**
  - **Canopy Wake** — window focus restores glass saturation and edge definition.
  - **Ion Trace** — Session selection sends one brief charge along the canopy/deck seam toward the
    newly selected row.
  - **Signal Bloom** — a newly arrived attention or completion state emits one restrained ring, then
    holds static.
  - **Lens Palette** — the command palette sharpens into place with a tiny scale settle.
  - **Dock Latch** — terminal expansion draws a fine highlight along its seam before revealing the
    live caret.
  - **Project Refraction** — changing projects moves selection and edge luminance while the native
    sidebar material remains untinted and the Instrument Deck changes cleanly.
  - **Focus Handoff** — keyboard focus moves between adjacent controls as one precise illuminated
    edge rather than unrelated flashing outlines.
- **Boundary:** These are candidates for the Sessions study, not permission to animate every call
  site. A moment ships only if it remains clear at normal working speed and degrades cleanly under
  Reduced Motion.
- **`Ion Trace` is not the feed's ion — [#614](https://github.com/milad-alizadeh/argo/issues/614) —
  2026-08-11:** `Ion Trace` is one of the delight moments above — a single charge along the
  canopy/deck seam when the active Session changes, deferred by D41. The feed's **ion** is a live
  operational signal, looping inside the Instrument Deck for as long as a Turn is in flight
  ([`cockpit-feed-working.md`](cockpit-feed-working.md), under D12's bound). They share the
  palette's word for Argo's accent and nothing else. Deferring or dropping `Ion Trace` says nothing
  about the feed's ion, and shipping the feed's ion does not un-defer `Ion Trace`.

## D14 — Glass is rationed by surface hierarchy

- **Decision:** Use native environmental glass for the permanent vertical sidebar and separate
  optical glass islands for important top controls and major transient surfaces such as the command
  palette. Ordinary menus and popovers are nearly opaque graphite with a restrained glass edge;
  tooltips are compact and crisp; nested working regions remain solid.
- **Why:** Different material classes make depth and permanence immediately legible. Rendering every
  floating rectangle as frosted glass would destroy that hierarchy and recreate the generic
  glassmorphism-card aesthetic this direction is intended to avoid.
- **Consequence:** `Lens Palette` is allowed to be a visual event because routine floating controls
  do not compete with it. Transparency is earned by architectural or interaction importance, not
  applied as a component-library default.
- **Transient surfaces — 2026-08-09:** **Transient surfaces floating over the deck are glass;
  furniture in it stays flat.** A surface qualifies when it is present because of a state the reader
  is in — a reading that has stopped following, a plan being pointed at — and absent otherwise. It
  is a category and not a list, so the next such control needs no further amendment. What stays
  flat is everything that is a ZONE of the deck rather than a state over it: roster rows, tabs, the
  Agents rail, the minimap and the Dock. **Why:** drawing a transient surface in the same material
  as the plane it covers makes it read as part of the record. The material is what says the
  difference between a thing the deck IS and a thing the deck is currently DOING. This amends D21's
  "feed controls remain flat" and the "nearly opaque graphite" recipe above, which stays the rule
  for an ordinary popover or menu — those hang off a control the reader clicked rather than
  standing over the reading on their own. D21's shipping gates apply unchanged, and its
  "individual icons do not receive separate glass bubbles" survives: these are whole surfaces, not
  decorated icons.

## D15 — Refine Phosphor instead of replacing it

- **Decision:** Keep Phosphor as the icon family and define a deliberate optical system around it
  rather than commissioning or adopting a new family.
- **Treatment:** Standardise a small set of optical boxes; use stronger regular strokes where icons
  sit on glass and lighter strokes in quiet deck regions; reserve fill for active or state-bearing
  moments; correct visual alignment per glyph instead of assuming equal bounds.
- **Why:** A custom icon family carries a large consistency and maintenance cost without addressing
  the cockpit's actual identity problem. Material, typography, geometry, and optical response offer
  substantially more distinctive leverage.
- **Boundary:** Weight or fill transitions may participate in `Focus Handoff`, but icons do not
  bounce, morph decoratively, or carry colour without meaning.

## D16 — Density follows the information role

- **Decision:** Use selective density rather than one compactness setting across the cockpit.
  Navigation, roster rows, metadata, and controls remain tight and scannable; Session identity,
  current activity, prose, and review findings receive enough space for calm reading; diffs,
  telemetry, branches, and terminal data retain machine density.
- **Why:** Uniform compression would pull the product toward the rejected editor aesthetic, while
  uniform spaciousness would waste the cockpit's ability to show operational context. Density is a
  hierarchy tool, not a global mood.
- **Consequence:** The token study must validate at least distinct navigation, reading, and machine
  rhythms. Empty space around the active decision is protected rather than automatically filled
  with more chrome.

## D17 — Neutral graphite carries the work

- **Decision:** The Instrument Deck uses an almost neutral near-black graphite ramp. Coolness appears
  subtly in shadows and metallic hairlines rather than as an obvious navy fill.
- **Why:** Ion Blue reads as active light only when the resting surface is chromatically quiet. A
  blue-dipped workspace would resemble a generic futuristic dashboard, reduce the accent's signal
  value, and distort functional status colours.
- **Consequence:** Environmental colour belongs primarily to the native canopy. The opaque Deck
  remains predictable across wallpapers and preserves stable contrast for long-form reading, diffs,
  and terminal content.
- **The ramp, measured — 2026-08-07:** "near-black" was first read as *black*, and the ramp landed a
  rung and a half below the study, which made the shell read as a void beside it. The values are not
  a matter of taste: sampled off `cockpit-sessions-liquid-glass.png`, the Deck is **`#1E2024`** (the
  tone the whole study is built on — 77k sampled pixels, deck and rails alike), the chrome band is
  **`#191A1D`**, and a selected roster row is **`#2B2D31`**. A future ramp change re-samples the
  study; it does not re-guess — and it samples a **region**, taking the dominant tone of the whole
  band. A single pixel read `#313438` off the selected row here, eight points bright, because it
  landed on the row's top highlight; the histogram over the row is what is trustworthy.
- **Text follows the ramp:** lifting the Deck lowers every contrast ratio measured against it. The
  tertiary ink and the `idle` state both fell to 4.36:1 against the corrected Deck and were raised to
  clear the contract's 4.5 floor. Any future ramp move re-runs those assertions rather than assuming
  the ink still holds.

## D18 — Edges and tone establish depth

- **Decision:** Build depth primarily with material edges, restrained inner highlights, tonal steps,
  and hairline seams. Meaningful drop shadow is reserved for genuinely floating surfaces such as
  the command palette.
- **Treatment:** The Instrument Deck receives one precise outer rim; internal zones separate through
  tone and seams; selected rows change luminance and may gain an Ion Blue edge but do not rise into
  cards.
- **Why:** Shadowed rectangles reproduce web-dashboard layering and weaken the distinction between
  the permanent Deck and transient controls. Edge-led depth reads as manufactured material and
  remains clearer at cockpit density.

## D19 — Feed paths disclose progressively

- **Decision:** File rows show the filename by default. Add the shortest unique parent suffix only
  when nearby rows would otherwise be ambiguous; keep the full exact path behind hover, expansion,
  and Copy Path. An outside-workspace path receives a compact `external` marker rather than printing
  an absolute home-directory path inline.
- **Why:** The current filename-first renderer still appends a dim directory to every row, so long
  repeated paths dominate the single feed despite being secondary evidence. Disambiguation is
  necessary only at collisions; paying for it on every line makes routine work unreadable.
- **Honesty:** Nothing is summarized or discarded. The compact line changes disclosure priority;
  the recorded path remains available verbatim and paths outside the Session root are never
  shortened as though they belonged to the workspace.

## D20 — Collapsed commands use compact semantic signatures

- **Decision:** A collapsed command event shows a concise, recognisable signature instead of the
  complete raw shell command. Lead with the executable or operation, retain the arguments that
  identify intent or target, and suppress transport syntax, repeated absolute paths, quoting noise,
  heredoc bodies, and other execution scaffolding from the default row.
- **Examples:** Prefer signatures such as `rg · search "toggleDevTools" in desktop`,
  `bun test · cockpit`, or `git diff · Session feed` over a one-line reproduction of every flag,
  pipe, redirection, and absolute path. These examples establish the information priority rather
  than a fixed grammar for every tool.
- **Disclosure:** Expanding the event reveals the exact command and its output. The untouched raw
  command remains directly copyable, and an unrecognised command falls back to a safe compact
  representation without inventing intent.
- **Why:** Full command strings make the chronological feed read like an unfiltered terminal and
  compete with results, file changes, and agent narration. A semantic signature preserves fast
  recognition while progressive disclosure keeps the execution record auditable.

## D21 — Native Liquid Glass is a bounded shell primitive

- **Decision:** The first native Liquid Glass implementation contains exactly two stable shell
  groups: one capsule for the Rooms switcher and one capsule for Git controls. Concierge becomes a
  third, compact glass control only when it has a genuine click action. Related controls share one
  vessel; individual icons do not receive separate glass bubbles.
- **Composition:** Native SwiftUI controls own their material, pointer and keyboard interaction,
  focus, shortcuts, semantics, and accessibility. Argo supplies the icons, labels, semantic state,
  and grouping. Sidebar navigation, roster rows, tabs, feed controls, Agents, minimap, and Dock
  remain flat within their existing material zones.
- **Amended — 2026-08-09:** D14's transient-surfaces clause carves the deck's floating controls out
  of that list — the plan pill, its revealed step list and the way-back-to-the-newest control are
  glass, because each is present only while the reader is in a state and absent otherwise. "Feed
  controls remain flat" now means the furniture of the feed. Roster rows, tabs, Agents, minimap and
  Dock are untouched, and one clause covers whatever floats over the deck next.
- **Implementation posture:** Use the macOS 26 SwiftUI Liquid Glass APIs directly in the production
  toolbar. Use a shared native vessel for each related group rather than applying material to every
  icon. Do not introduce an AppKit material bridge or a custom blur implementation.
- **Shipping gates:** Prove resizing, display scaling, fullscreen, active and inactive windows, hit
  testing, keyboard focus, Reduce Transparency, Increased Contrast, cleanup, packaging, signing,
  and notarisation on macOS 26. There is no older-system fallback and no navigation or action may
  depend on a decorative optical response.
- **Why:** Two intentional toolbar vessels reproduce the disciplined grouping visible in native
  macOS applications while preserving Argo's own interface. Spreading glass across every clickable
  element would create noisy glassmorphism and erase the hierarchy established in D14.

## D22 — The corrected Liquid Glass single-feed study is approved

- **Decision:** Lock
  [`cockpit-sessions-liquid-glass.png`](cockpit-sessions-liquid-glass.png) as the visual reference
  for implementing the replacement identity in Sessions. The corrected final study supersedes the
  earlier generated concepts and the Penumbra Session-interior look.
- **What the study locks:** A continuous neutral native sidebar; a straight material boundary into
  the graphite Instrument Deck; flat roster rows; two top-level Liquid Glass vessels for Rooms and
  Git; the current Agents rail plus one chronological feed; filename-first file changes; compact
  command signatures and outcomes; a quiet narrow minimap with an Ion Blue viewport; and an
  attached, visually subordinate Dock.
- **What it does not lock:** Generated letterforms, incidental sample data, exact pixel values, or
  accidental icon substitutions. UX specifications, real domain state, accessibility, responsive
  behaviour, and the token contract remain authoritative during implementation.
- **Supersedes:** All images generated earlier in this grill; Penumbra as the target visual
  identity; and the retired master–detail/timeline interpretation of the Session interior. Those
  artifacts may remain only as clearly labelled lineage until their dependent legacy harnesses are
  removed.

## D23 — Replace directly on an isolated reskin branch

- **Decision:** Do not add a runtime feature flag or ship parallel Penumbra and replacement themes.
  Implement the reskin directly in a dedicated branch and worktree, where the real Sessions screen
  can be exercised before the branch lands.
- **Delivery shape:** Deliver the native rewrite through the ordered child tickets of #373, each in
  its own branch and worktree: foundations, shell material, Sessions composition, feed disclosure,
  minimap and Dock refinement, motion, and final deletion. Validate every coherent checkpoint in
  the real macOS window with the applicable Swift tests and repository quality gates.
- **Boundary:** Temporary migration seams may exist between commits on the branch, but no permanent
  compatibility layer, duplicate component tree, theme switch, or dormant old-style code lands in
  the application.
- **Why:** Argo is not live, so a feature flag would create state combinations and cleanup work
  without reducing user risk. Branch isolation supplies the necessary comparison and recovery
  boundary while allowing the final codebase to express one visual system cleanly.

## D24 — Use the native macOS type pair

- **Decision:** Use SF Pro for Session titles, identity headings, controls, navigation, metadata,
  and prose; and SF Mono for commands, branches, paths, diffs, telemetry, and terminal-adjacent
  facts. There is no third, serif voice.
- **Delivery:** Resolve the families through macOS system stacks rather than bundling copies. Define
  their metrics as semantic type-role tokens, including size, line height, weight, and tracking;
  components consume those roles rather than naming fonts or dimensions locally.
- **Boundary:** SF Mono communicates machine evidence rather than decorating ordinary UI labels.
  Platform fallbacks must preserve the sans and mono roles without pretending to be exact Apple
  fonts. Hierarchy inside SF Pro comes from rung, weight, and tracking, not from a second family.
- **Why:** Two families separate human intent and interface language from machine output, which is
  the distinction the cockpit actually reads on, and they do it in the native macOS voice without
  adding font files or another visual dependency.
- **Amended by [#502](https://github.com/milad-alizadeh/argo/issues/502) — 2026-08-10:** this read
  as a trio, assigning New York to Session titles and rare identity headings. Corrected because the
  serif was never implemented — `ArgoTypeface` carries exactly two cases, `interface` and `machine`,
  and the running app draws SF everywhere — so the prose described a cockpit that does not exist.

## D25 — The minimap is a semantic event overview

- **Decision:** Replace the literal miniature of feed rows with a quiet semantic map. Vertical
  position continues to correspond to chronological position, while a small vocabulary of shapes
  identifies narration, commands, file changes, expanded diffs, images or artifacts, and attention
  events. The visible feed range remains a precise Ion Blue viewport outline.
- **Visual reference:**
  [`cockpit-xcode-minimap-reference.png`](cockpit-xcode-minimap-reference.png) is the direct grammar
  reference: vertically faithful micro-line silhouettes, meaningful indentation and relative
  length, a quiet edge rail, restrained colour, and a translucent viewport wash. It is a reference
  for clarity and proportion, not for Xcode's light theme or source-code semantics.
- **Encoding:** Narration uses a quiet neutral line; commands a compact slate bar; file changes a
  green/coral split mark; expanded diffs a taller change block; images and rendered artifacts a
  framed rectangle; and `needs you` a tiny amber marker. Shape carries event class so the map never
  depends on colour alone.
- **Weight:** Block height may communicate approximate event weight, but it is capped. A huge diff,
  log, or image gallery cannot consume the overview in proportion to every rendered line or pixel.
  The map never embeds actual thumbnails, readable text, paths, or raw miniature diff content; its
  line-like marks are deterministic semantic projections from the same matrix as the feed.
- **Interaction:** Preserve the existing navigation behaviour: clicking or dragging moves through
  the same single chronological feed. The change affects representation, not destination or feed
  structure.
- **Why:** The current density gutter repeats the feed's visual noise at an unreadable scale. A
  semantic overview answers what kinds of evidence exist, where they occur, and where the viewport
  sits without becoming another information surface to decipher.
- **Amended by [#382](https://github.com/milad-alizadeh/argo/issues/382) — 2026-08-10:** "a small
  vocabulary of shapes" is now the rows' OWN shapes at the lane's scale — a prompt is its bubble on
  the trailing edge, a paragraph is one bar per measured line with the last one ragged, a call is a
  slab as long as its sentence. The encoding above still holds; what changed is that the shapes are
  derived from each row rather than assigned to a class. "Never readable text" holds for the
  miniature and no longer for the annotations over it: hovering a Turn draws its prompt as real
  text, and ⇧⌘ draws every one on screen.
- **Amended on the reader's call — 2026-08-12:** **the Ion Blue line spanning a Turn is drawn for the
  hovered Turn alone**, against #382's "an Ion Blue line spans its extent". One per Turn at rest made
  the lane a near-continuous blue rail, spending the app's loudest colour on saying a session has
  Turns in it. Asked for directly while the work was being reviewed on screen, so it overrides the
  ticket rather than reinterpreting it.
- **Amended on the reader's call — 2026-08-13:** **the rows REPORT their own geometry and the lane
  only scales it.** #382 derived a row's shape from the row, but the lane was still handed the row's
  measured height alone and worked the rest out for itself — how many lines that was, how wide each
  ran, where a link sat, where a table's rows fell. Two models of one row drift, and every complaint
  about the lane traced to that drift rather than to the encoding. A row now reports the rectangles it
  drew in the feed's own points; the lane counts no lines and divides no characters.
- **Amended on the reader's call — 2026-08-13:** **a question is drawn as its card, not as a band.**
  Against "`needs you` a tiny amber marker" and #382's full-width band, a pending question is now the
  bordered card the feed draws: a frame across the whole measure with the question's own lines and its
  options inside it. The band matched neither the row's shape nor its weight — a wash with words in it
  read in the lane as a solid slab of the loudest colour the app has, which is what was asked about.
  "Shape carries event class so the map never depends on colour alone" is unchanged and now better
  served: a stroked full-measure container with content inside it is a shape nothing else in the lane
  takes, and `FeedInk.Shape.band` is gone with the band.
- **Amended on the reader's call — 2026-08-12:** **the weight cap no longer cuts a block below its
  own scaled extent.** Since the shapes became the rows' own at the lane's scale, a row can never
  outgrow its true share of the scroll — but the old per-event ceiling cut a long message's block at
  its head and left the rest of its span as dead lane, which read as a hole in the session. The cap's
  claim survives as the extent itself: weight is the row's real length, never more.

## D26 — Heavy evidence summarizes, then expands inline

- **Decision:** Images, rendered artifacts, file diffs, and long command output appear as compact,
  truthful summary rows by default. Activating a row expands the complete evidence in place within
  the same chronological feed; it never opens a second detail pane or navigates away.
- **Summaries:** A diff identifies its file count and aggregate additions/deletions; an image or
  artifact identifies its filename, kind, and useful dimensions; command output identifies the
  outcome or result count established in D20. Summaries must derive from recorded facts and never
  paraphrase evidence through an LLM.
- **Expansion:** Expanded content preserves exact text, diff structure, image fidelity, copy
  actions, and any existing evidence-specific controls. Expansion state belongs to the user's
  reading session and must not collapse unexpectedly as new feed events arrive.
- **Composition:** Summary rows and expanded evidence remain zones of the continuous Instrument
  Deck, separated by rhythm and hairlines rather than becoming rounded cards. The semantic minimap
  uses the corresponding D25 shape in either state.
- **Why:** Large evidence is essential but visually disproportionate during routine scanning.
  Progressive disclosure keeps the feed calm and dense without discarding auditability or
  reintroducing master–detail navigation.

## D27 — Failed commands expose one diagnostic line

- **Decision:** A failed command remains a compact summary but shows the first useful diagnostic
  line immediately beneath it. Successful commands remain one line. Expanding the failed event
  reveals its complete unmodified output as defined in D26.
- **Selection:** Choose the diagnostic deterministically from recorded stderr, structured test
  failure data, or the first non-scaffolding error line. Do not ask an LLM to interpret, summarize,
  or rewrite the failure. If no trustworthy diagnostic exists, show only the exit status.
- **Treatment:** The summary carries a restrained failure mark and exit code; the diagnostic uses
  one quiet line with filename-first path disclosure from D19. Long diagnostics truncate visually
  but remain available verbatim through expansion and copy.
- **Why:** Failure is the exception that must explain itself during a scan. One exact line provides
  orientation without forcing every failed command open or allowing raw output to overwhelm the
  chronological feed.

## D28 — Attention never reorders chronology

- **Decision:** `Needs you` events stay at their original chronological position. The feed never
  pins, promotes, duplicates, groups, or re-sorts an event because it requires attention.
- **Wayfinding:** Unresolved attention is echoed through the tiny amber Session state and the D25
  minimap marker, which navigate to the original event rather than creating another representation
  inside the feed. Resolving it removes the live attention signal but leaves the historical event
  and outcome in place.
- **Boundary:** Arrival may use the one-shot `Signal Bloom` from D13, but no persistent glow, sticky
  card, or floating alert competes with the record. Ordering remains a property of captured time,
  not urgency.
- **Why:** The single feed is an execution record. Reordering for urgency would make cause and
  effect harder to follow and create uncertainty about whether an event moved, repeated, or
  disappeared.

## D29 — Media and diffs use evidence-specific surfaces

- **Decision:** Expanded images and rendered artifacts sit in a neutral matte media well. Expanded
  file diffs use a full-width machine inset with aligned line-number and change gutters. Both are
  solid zones of the Instrument Deck, never glass or floating cards.
- **Media treatment:** The matte safely frames varying aspect ratios and transparency without
  borrowing colour from the image into the surrounding interface. Checkerboard appears only when
  transparency is evidence. Useful metadata and actions remain subordinate to the artifact.
- **Diff treatment:** Give code the maximum practical horizontal span, stable mono metrics, quiet
  gutters, and restrained addition/deletion fields. Do not wrap a diff in an ornamental outer card
  or constrain it to the image preview's proportions.
- **Shared behaviour:** Both begin with the compact summary specified in D26, expand inline, retain
  user-controlled expansion state, and register their semantic shape in the D25 minimap.
- **Why:** Images need a visual boundary; diffs need alignment and width. Forcing them through one
  generic evidence card would compromise both and reintroduce the component-library aesthetic the
  Instrument Deck avoids.

## D30 — The Sessions roster discloses context progressively

- **Decision:** Each roster row leads with the Session title and carries at most one quiet metadata
  line for the model and recognisable workspace or repository name. Do not print absolute paths or
  repeat long technical state words in every row.
- **Exceptional state:** Replace repeated `READ-ONLY` text with a compact lock state shown only when
  it distinguishes the Session. Operational state continues through the canonical dot and concise
  status vocabulary; counts and time appear only when they help scanning.
- **Disclosure:** Hover, focus, or inspection reveals the complete path and remaining technical
  facts, with direct copy where appropriate. Truncation never changes the stored title, workspace,
  or path.
- **Composition:** Rows remain flat over the continuous native sidebar. Selection uses a restrained
  neutral wash rather than a bordered or elevated card.
- **Selection amendment — 2026-08-07:** On macOS 26 the sidebar's own rounded, inset capsule **is**
  that wash, and the roster does not draw a second one. The study's full-bleed wash and leading Ion
  Blue rail were drawn in Electron, where no system selection existed; reproducing them natively
  means leaving `.listStyle(.sidebar)`, and that is where the sidebar's Liquid Glass comes from
  (D3) — so the study loses this one and the platform keeps it. The capsule is tinted onto the
  neutral ramp rather than taking the accent, so selection stays an ink wash and Ion Blue is not
  spent on it. Ruled out, and not to be reopened by a fidelity pass: a custom wash painted over the
  system capsule (two stacked highlights) and a rail pinned inside the capsule's inset edge.
- **The Ion Blue indicator is dropped, by decision and not by necessity.** #377's criterion read
  "a neutral native wash **plus a thin Ion Blue indicator**", and that half is retired here. Only
  the two placements above were shown to be unworkable; a rail in the leading gutter, outside the
  capsule entirely, was never tried and is not claimed to be impossible. It was dropped because the
  capsule alone is what macOS selection looks like, and a brand rail beside it re-states selection a
  second time. Reopening this needs nothing more than someone deciding the rail earns its keep.
- **Where the capsule's colour lives:** the **`AccentColor` asset**, and nowhere else. SwiftUI's
  `.tint` does not reach a macOS sidebar's selection; the asset shipped as an empty stub, so
  selection was the OS default rather than anything Argo chose. It now carries `#2B2D31`, the
  study's selected row. The cost is accepted knowingly and is not a bug to file later: that asset is
  app-wide, so every focus ring and accented control is graphite too, and D6's Ion Blue reaches them
  only through an explicit `.tint`, which does still work everywhere except here.
- **How to judge it:** on an **active** window only, and in a preview that belongs to the **app**
  target. An inactive window draws selection in the system's neutral grey whatever the accent says,
  so a wrong accent looks exactly like a correct neutral wash — that artefact cost two rounds here.
  A preview of an `ArgoUI` view builds the package alone and cannot see the asset, so it shows the
  OS accent and is worthless for this one check.
- **Amended by [#875](https://github.com/milad-alizadeh/argo/issues/875) — 2026-08-28: the wash is
  Ion Blue, and the platform does not draw it.** Two clauses go: the one that keeps selection an ink
  wash, and the one that names the asset as where the capsule's colour lives.

  The trade the first made — spend no brand hue on selection, keep the neutral ramp intact — was
  judged wrong on a pass over the running app. The accent was defined in the palette and spent
  nowhere a reader meets it, and the one piece of state a reader tracks all day was drawn in a grey
  a shade off the background. Selection is exactly where the identity has to be legible.

  The second was simply no longer true. **On macOS 26 the `.listStyle(.sidebar)` selection capsule
  is a fixed neutral.** Neither `.tint` nor the `AccentColor` asset moves it by a value — both
  measured, not reasoned: a scarlet asset was shipped and the shell re-rendered, and the capsule
  stayed `#464646` with the window active and the row clicked, while the rooms picker in the same
  frame went scarlet. So the route D30 recorded is closed, and the wash is Argo's to draw.

  - **How it is drawn now.** `SessionNavigator` gives the selected row a `listRowBackground` of
    `interaction.selectionGround` — `interaction.accent` at 0.10. That REPLACES the style's capsule
    rather than painting over it, which is what makes it the opposite of the option ruled out
    below: there is one highlight in the row, not two, and the measured render carries no grey
    capsule anywhere in the band. It is the study's own full-bleed wash, back — and it holds its
    colour while the list is not first responder, where the platform would grey it out.
  - **The weight is arithmetic, not taste.** A saturated Ion Blue row cannot carry this app's inks:
    `text.primary` on `#3E9BFF` measures 2.60:1. At 0.10 every roster voice reads at least as well
    as it did on the neutral wash this replaces, and the ground carries four times its chroma.
    `SelectionGroundTests` asserts both, against the old wash rather than against a number.
  - **The asset now carries the accent at FULL strength**, `#3E9BFF`, because what it still reaches
    is the loud rung. The one placement nobody expected is the **rooms picker**:
    `NSSegmentedControl` under Liquid Glass ignores `selectedSegmentBezelColor` (#857) but reads the
    asset, and fills the selected segment with it outright. So finding 2 of #875 closes on the
    app-wide asset alone, with no hand-rolled control — and one hue now reads at two weights, full
    on the segment and a wash on the row. `AccentAssetTests` fails the build if asset and palette
    ever part again. Every stock accented control and focus ring in the app moved with it, which is
    the intent and not a side effect.
  - **Still not reopened:** the leading Ion Blue rail. A selected row is carried by its ground
    alone. The clause below stands exactly as written.
- **Why:** Repeated paths and all-caps state labels make the roster read like a diagnostic table.
  Progressive disclosure preserves the same Session controls and evidence while restoring a clear
  title-and-context scan pattern.

## D31 — The Session header shows operational essentials

- **Decision:** The default header shows the Session title, current meaningful state, branch or
  detached `HEAD`, and useful elapsed or idle time. Absent, unknown, default, or accounting-oriented
  facts do not occupy the primary header line.
- **Removed noise:** Do not render `unknown` as a fact or as a large placeholder medallion. What
  remains absent, default, or unreadable stays off the primary line rather than occupying it with a
  placeholder.
- **Composition:** The SF Pro title is the human anchor. Operational facts form one quiet,
  right-aligned strip using SF Pro and SF Mono by role; separators and labels appear only where they
  prevent ambiguity. The inspection surface follows D14's nearly opaque graphite popover recipe,
  not a new glass island, and it **explains** — it names the thresholds and what handing off does
  rather than repeating a reading already on the line.
- **Why:** The current header gives absent identity the same prominence as the Session's purpose.
  Removing placeholders restores a glanceable hierarchy without discarding information.
- **Amended by [#502](https://github.com/milad-alizadeh/argo/issues/502) — 2026-08-10:** two
  clauses go. The title was assigned New York, corrected for the reason given in D24. And token
  counts and diagnostic telemetry were banished to the inspection surface; they now sit on the tab
  line with duration, because how full a Session's context is decides what you do next and a fact
  behind a click is a fact nobody reads. The popover keeps the explanation, not the numbers.
- **Amended by [#513](https://github.com/milad-alizadeh/argo/issues/513) — 2026-08-10:** the
  explanation opens on **hover** rather than on a click. It was a click so that a legend meant to be
  read would not fly open as the pointer crossed the header; a dwell before it opens buys the same
  thing without asking for a gesture to reach a paragraph. The ⓘ still opens it when clicked or
  focused, and never closes it — the keyboard's way in must not undo what the pointer just did.
- **Also #513:** once a Session's work has been handed over, the **Hand off** button leaves the
  header and the reading gains its one row that is a way OUT of itself: `handed off to <Session>`,
  at the foot under the spend, in the ink this app spends on links. The coloured reading stays as it
  was — the context really is that full — so what changes is the remedy, not the fact. The link
  **survives a restart**: it is written beside the brief it came from, in Argo's own per-machine
  data, and named with the fresh Session's real id once its CLI has written one. A handoff whose
  fresh agent never wrote a record leaves no link rather than one to a claim nobody can follow.

## D32 — Activity and Delivery are attached edge tabs

- **Decision:** Keep `Activity` and `Delivery` as text tabs attached to the Instrument Deck's content
  hierarchy. The active tab gains stronger type and one fine Ion Blue edge; inactive tabs remain
  quiet. Do not render them as pills, cards, segmented glass, or detached toolbar controls.
- **State:** Counts or exceptional status may sit beside a label when they communicate real content,
  but the active indicator remains identity colour and never inherits warning or failure colour.
- **Motion:** Moving between tabs may use the precise `Focus Handoff` response from D13. Reduced
  Motion changes the indicator immediately without a sliding or refractive transition.
- **Why:** These tabs switch material inside the Session workspace rather than changing rooms or
  invoking shell actions. Keeping them attached protects the hierarchy that reserves Liquid Glass
  for the Rooms and Git vessels.

## D33 — The Agents rail is structural and subordinate

- **Decision:** Keep the Agents rail permanently available in the Session workspace and retain its
  current navigation responsibility. Render it as a quiet structural zone of the Instrument Deck,
  not a floating panel, glass surface, or stack of agent cards.
- **Rows:** Use flat rows with the canonical compact state dot, agent name, and only useful status or
  duration metadata. Selection uses a neutral wash and precise Ion Blue focus edge; completion and
  attention colours remain semantic and small.
- **Hierarchy:** The rail's labels, dividers, and metadata sit below the active feed in contrast.
  The selected agent becomes clear through alignment and state, not elevated geometry or glow.
- **Why:** Agents are essential navigation, but the active feed is the reading surface. Reducing the
  rail's material weight keeps both continuously available without creating two competing focal
  planes.

## D34 — The Dock is an attached mechanical seam

- **Decision:** Keep the Dock attached to the bottom of the Instrument Deck. Its collapsed header
  shows only the channel, live state, and compact last-command signature; long raw commands, paths,
  and transcript detail stay behind expansion and copy.
- **Expansion:** Preserve the Dock's existing reveal and resize responsibilities. The `Dock Latch`
  response from D13 draws one restrained seam highlight before exposing a pure near-black terminal
  surface. Reduced Motion reveals it immediately.
- **Composition:** Use a straight shared boundary, aligned header facts, and a small disclosure
  control. Do not wrap the Dock in a rounded container, lift it with shadow, or apply glass to the
  terminal.
- **Why:** The terminal is a working mechanism inside the Session, not a floating destination.
  Treating its boundary like a precise latch preserves rapid access while keeping the collapsed
  workspace calm.

## D35 — The top bar is empty space plus control vessels

- **Decision:** Do not paint a top-bar background band, divider, canopy, or toolbar plate. The
  visible shell chrome at that altitude consists of native traffic lights and the separate Rooms
  and Git Liquid Glass vessels over a draggable continuation of the surrounding material.
- **Layout:** Protect clear drag regions and native window-control spacing. The vessels align to one
  optical baseline but remain separate groups; empty space between them is intentional and never
  filled merely to make the bar appear continuous.
- **Boundary:** Connection or Concierge controls appear at this level only when they carry a real
  state or action, following D21. They do not cause the return of a full-width container.
- **Why:** A painted band would add a third dominant plane between the native sidebar and Instrument
  Deck. Removing it lets material hierarchy, not a web toolbar rectangle, define the shell.

## D36 — Concierge earns its control through behaviour

- **Decision:** Remove the large Concierge orb from the initial reskin. Do not display a decorative
  orb, empty glass circle, or faux button while Concierge has no click action.
- **Interim state:** When assistant or connection state must be communicated, use the smallest
  factual status treatment appropriate to that state rather than preserving the orb as branding.
- **Return condition:** Concierge may become the third compact Liquid Glass control defined in D21
  only when activating it opens or performs a real, specified interaction with keyboard and
  accessibility behaviour.
- **Why:** An inert object with button geometry creates false affordance and spends the shell's most
  distinctive material on decoration. Delaying it makes its eventual arrival meaningful and keeps
  the first implementation honest.

## D37 — Healthy connection is silent

- **Decision:** Show no persistent connection control while the application is healthy. A compact
  transient graphite chip appears at the top-control altitude only when connection state is
  degraded, failed, or offers a meaningful recovery action.
- **State:** Reconnecting or attention uses a tiny amber signal; failure uses restrained red/coral.
  Text states the condition plainly, and an available retry or reconnect action names its result.
  The chip disappears when health returns.
- **Material:** The chip is a nearly opaque status surface with a precise edge, not a third permanent
  Liquid Glass vessel. It joins the top control cluster without creating a full-width bar.
- **Why:** Healthy connectivity is expected rather than information. Removing its permanent chrome
  preserves room for exceptions and keeps the two approved glass vessels visually intentional.

## D38 — Room shortcuts disclose on demand

- **Decision:** The Rooms Liquid Glass vessel shows only `Sessions`, `Work`, and `Code` in its default
  state. Do not print `⌘1`, `⌘2`, or `⌘3` permanently inside the capsule.
- **Discovery:** Preserve the shortcuts unchanged and expose them through hover and keyboard-focus
  tooltips, the command palette, and the application's shortcut reference. Accessible names include
  the shortcut without requiring visual text.
- **Why:** The three room names are already concise and self-explanatory. Removing permanent shortcut
  glyphs gives the segmented glass room to refract and keeps advanced help available where users
  expect it.

## D39 — Git shows the checkout and meaningful exceptions

- **Decision:** The Git Liquid Glass vessel's healthy baseline shows the current branch or detached
  `HEAD`, its disclosure chevron, and the existing overflow action within the same related control
  group. Zero ahead/behind counts and healthy checks are not rendered.
- **Exceptions:** Non-zero divergence, conflicts, failed checks, or an available recovery action may
  add a concise fact inside the vessel. State colour remains compact and semantic; it does not tint
  the entire glass material.
- **Scope:** This is the global primary-checkout control. A Session's own branch remains a Session
  fact at the header altitude established in D31, preserving the existing distinction.
- **Why:** Branch identity is continuously useful; routine zeroes are not. Exception-led telemetry
  reduces noise while keeping actionable repository state next to the control that resolves it.

## D40 — Radius communicates physical role

- **Decision:** Reserve visibly rounded geometry for elements that genuinely float, detach, or need
  a protective boundary: the native window, Liquid Glass control vessels, command palette, compact
  transient controls, and media wells. Structural workspace regions use square or very small-radius
  geometry.
- **Structural treatment:** The Instrument Deck, Session and Agents rails, feed groups, diff insets,
  minimap, and Dock meet through straight seams and aligned edges. Selected rows may use a subtle
  tokenised softening but never become individual cards.
- **Token posture:** Exact radii are settled in the foundation study as a short role-based ladder,
  not copied from the generated image or chosen independently per component. Pill geometry is
  limited to true capsules and compact status controls.
- **Why:** When every region is rounded, hierarchy collapses into a collection of interchangeable
  web cards. Restricting curvature makes the native glass controls feel special and the working
  surface feel engineered.

## D41 — The first reskin ships five delight moments

- **Decision:** Implement `Canopy Wake`, `Focus Handoff`, `Signal Bloom`, `Dock Latch`, and
  `Lens Palette` in the first reskin. Defer `Ion Trace` and `Project Refraction` until the completed
  static hierarchy and core motion have been judged together in the running application.
- **Character:** Every response remains optical-mechanical and event-driven: focus restores native
  material presence, focus edges hand off precisely, attention emits one signal, the Dock latches,
  and the palette settles into focus. Nothing moves ambiently or follows the pointer.
- **Accessibility:** Each effect has a Reduced Motion interpretation that preserves the state change
  through immediate luminance, edge, or visibility changes. No action, status, or focus location is
  communicated through motion alone.
- **Why:** These five moments cover window, keyboard, system attention, workspace mechanism, and
  global invocation without repeating the same flourish everywhere. Deferring the two seam-tracing
  effects protects the direction from becoming a light show before its restraint can be evaluated.
- **Scope — [#614](https://github.com/milad-alizadeh/argo/issues/614) — 2026-08-11:** every clause
  here binds **delight moments** only. For what "Nothing moves ambiently" leaves out, see D12's
  bound; for what deferring `Ion Trace` does not defer, see D13.

## D42 — Prove the native-material composition first

- **Decision:** The first production UI checkpoint proves the whole native composition in one real
  SwiftUI window: continuous system sidebar, opaque Instrument Deck, and the two bounded Liquid
  Glass toolbar vessels. The earlier Electron/AppKit spike was superseded by ADR-0022 and is not an
  implementation dependency.
- **Proof matrix:** Validate the macOS 26 system rendering; Retina and display-scale changes; resize
  and fullscreen; active and inactive windows; Reduce Transparency; Increased Contrast; hit
  testing; keyboard focus; drag regions; relaunch; cleanup; packaging; signing; and notarisation.
- **Output:** Retain native SwiftUI structure and semantic presentation models. Material details do
  not leak into ordinary content components, and no bridge, compatibility layer, or alternate
  renderer path survives the checkpoint.
- **Why:** Native control islands are the direction's one material implementation uncertainty and
  affect window transparency and composition beneath every subsequent visual checkpoint. Proving
  that seam first prevents the token and component rebuild from depending on an imagined substrate.

## D43 — Every macOS glass generation remains native

- **Decision:** Argo targets macOS 26 only, and every glass surface uses the native SwiftUI Liquid
  Glass generation supplied by that system. Do not implement a CSS blur, canvas blur, captured
  wallpaper, painted imitation, `NSVisualEffectView` compatibility path, or `#available` branch.
- **Runtime posture:** There is one native composition and one semantic control hierarchy. If a
  material effect becomes unavailable because of an accessibility setting, content and actions
  remain legible through system behaviour and Argo's semantic foreground roles; the app does not
  swap to a counterfeit material.
- **SwiftUI role:** SwiftUI owns control content, interaction, accessibility, focus, and material.
  Custom drawing may express the restrained identity responses defined elsewhere, but cannot create
  or pretend to be the environmental substrate.
- **Why:** A single macOS 26 target keeps the material honest, removes compatibility code before the
  app ships, and lets the design rely on current native behaviour without imitating it.

## D44 — Foundations precede component styling

- **Decision:** Establish the replacement foundation contract before styling production components.
  Settle the neutral graphite ramp, semantic colours, native type roles, density rhythms, radius
  ladder, material edges, elevation, and motion in `ArgoUI/VisualContract` and its rendered specimen
  first. Ticket #375 owns that checkpoint; later tickets consume it rather than restating values.
- **Validation:** Exercise the contract against the permanent native sidebar, opaque Instrument
  Deck, native Liquid Glass vessels, active and inactive windows, varied wallpapers, Increased
  Contrast, Reduce Transparency, and Reduced Motion. Tokens are accepted through rendered
  comparison, not as an isolated palette list.
- **Migration:** Components consume the coherent replacement contract in subsequent checkpoints.
  Temporary visual seams may exist between commits on the isolated branch, but raw replacement
  values or local one-off styles never bridge the gap.
- **Why:** Penumbra's identity is encoded in shared foundations as much as individual components.
  Styling components first would reproduce the old system's inconsistency under new colours and
  force the same material decisions to be made repeatedly.

## D45 — Preserve semantic tokens, remove identity debt

- **Decision:** Preserve existing token names when they express a durable semantic role such as
  background, foreground, border, focus, or an operational state. Delete or rename tokens whose
  meaning encodes Penumbra-specific gold illumination, atmospheric scene lighting, card planes, or
  other superseded visual concepts.
- **Migration:** A renamed or removed identity token is updated at all consumers in the same
  checkpoint. Do not leave compatibility aliases, deprecated duplicate values, or misleading names
  that allow old styling to survive invisibly.
- **Review test:** A token survives because the interface still needs its role, not because changing
  call sites is inconvenient. A new token earns a role through the replacement foundations study
  and is never named after a literal colour, pixel value, or one component.
- **Why:** Stable semantics reduce meaningless component churn, while preserving Penumbra-specific
  vocabulary would smuggle the rejected identity into the replacement contract and confuse future
  maintenance.

## D46 — Delete Penumbra completely from the application

- **Decision:** As replacement checkpoints land, delete every Penumbra-only scene component,
  atmospheric lighting effect, gold identity treatment, obsolete token, style recipe, and unused
  visual asset. Do not retain a dormant theme, runtime switch, compatibility alias, fallback path,
  or hidden legacy component tree.
- **Completion test:** The landed application contains no runnable or selectable Penumbra visual
  system and no token whose only purpose is recreating it. References may remain solely in written
  historical decision records and Git history, where they cannot affect rendering or imply current
  authority.
- **Delivery:** Remove each obsolete dependency in the same checkpoint that replaces its remaining
  consumers, keeping commits buildable and making stale aliases or assets mechanically detectable.
- **Why:** Argo is not live and D23 rejects parallel themes. Keeping Penumbra after the direct
  replacement would create ambiguity without protecting a user migration or rollback requirement.
