/// The one implemented appearance: near-black graphite with Ion Blue. Every neutral is a true
/// grey with at most a few points of cool lift — more than that and the surfaces start to tint.
public extension ArgoPalette {
    static let graphite = ArgoPalette(
        surface: SurfaceRoles(
            // Sampled from the approved study, not chosen — see D17. Re-sample before moving
            // any of them, and re-run the contrast assertions after: every text and state
            // ink is measured against `base`.
            sunken: ArgoColor(hex: 0x191A1D),
            base: ArgoColor(hex: 0x1E2024),
            raised: ArgoColor(hex: 0x252729),
            overlay: ArgoColor(hex: 0x2E3136),
            glassTint: ArgoColor(hex: 0xFFFFFF, opacity: 0.06),
            hover: ArgoColor(hex: 0xFFFFFF, opacity: 0.045),
            // Resolves to #3B3E44 on the composer vessel — the study's Deny pill, sampled from
            // `docs/designs/composer/perm.png` rather than chosen.
            control: ArgoColor(hex: 0xFFFFFF, opacity: 0.06),
            // Resolves to #2B2D31 over `base` — the study's selected row, now spent on pressed and
            // current rather than on selection: the roster's capsule is Ion Blue as of #875.
            selected: ArgoColor(hex: 0xFFFFFF, opacity: 0.058),
            // Below `sunken` and nearly opaque.
            scrim: ArgoColor(hex: 0x0B0C0E, opacity: 0.90),
            // Above `hover` (0.045) and `selected` (0.058) by a clear margin, so a marked span
            // never reads as a row under the pointer, and quiet enough that a paragraph carrying
            // several filenames does not come out striped. Resolves to #2E3033 on the deck and
            // #343638 in a prompt's bubble.
            marked: ArgoColor(hex: 0xFFFFFF, opacity: 0.07),
        ),
        text: TextRoles(
            primary: ArgoColor(hex: 0xF2F4F6),
            secondary: ArgoColor(hex: 0xA8AEB5),
            // The quietest voice, so the rung `TextRoles.contrastFloor` binds hardest on. It is
            // read on three grounds, not just the deck, and clears the floor on each.
            tertiary: ArgoColor(hex: 0x929AA1),
            disabled: ArgoColor(hex: 0x4E545A),
            onAccent: ArgoColor(hex: 0x05070A),
            // There is no `code` ink. A marked span is drawn on `surface.marked` and keeps the
            // ink of the voice around it, floored by `TextRoles.marked(on:)`.
        ),
        edge: EdgeRoles(
            hairline: ArgoColor(hex: 0xFFFFFF, opacity: 0.08),
            subtle: ArgoColor(hex: 0xFFFFFF, opacity: 0.13),
            strong: ArgoColor(hex: 0xFFFFFF, opacity: 0.22),
            glassRim: ArgoColor(hex: 0xFFFFFF, opacity: 0.30),
        ),
        interaction: InteractionRoles(
            accent: ArgoColor(hex: 0x3E9BFF),
            accentBright: ArgoColor(hex: 0x6FB6FF),
            accentDeep: ArgoColor(hex: 0x1E6FD4),
            selectionIndicator: ArgoColor(hex: 0x3E9BFF),
            focusRing: ArgoColor(hex: 0x6FB6FF),
            // Deeper and duller than the failure ink above it: this is a GROUND under a whole
            // block of a row, not an ink.
            destructive: ArgoColor(hex: 0xB3372F),
            // `accent` at 0.18 over `sunken`, resolved — `SelectionGroundTests` re-derives it.
            selectionGround: ArgoColor(hex: 0x203146),
        ),
        state: StateRoles(
            running: ArgoColor(hex: 0x46D3A8),
            idle: ArgoColor(hex: 0x868E96),
            attention: ArgoColor(hex: 0xE8B24A),
            failure: ArgoColor(hex: 0xF2555C),
        ),
        // Held clear of `state.running` and `state.failure`, or a `+8` reads as a live Session.
        diff: DiffRoles(
            added: ArgoColor(hex: 0xA9D18E),
            removed: ArgoColor(hex: 0xD98C93),
        ),
        // Eight muted jewel tones. Each is held a state's own distance from all four states,
        // from Ion Blue and from BOTH diff inks — a pie and a patch are read in one feed inches
        // apart, so a pink wedge that resolves near `diff.removed` reads as a deleted line — and
        // from every other entry here. `interaction.destructive` is deliberately not in that set:
        // it is a ground under a swiped roster row, never an ink in the feed, so no wedge is ever
        // read beside it.
        //
        // Mid-luminance on purpose, and each at 3:1 or better on the deck: a wedge is a large
        // mark rather than a word, and these have to survive a light appearance a pastel would
        // not.
        series: SeriesRoles(hues: [
            ArgoColor(hex: 0x6666CC),
            ArgoColor(hex: 0x97A53B),
            ArgoColor(hex: 0x80B5D1),
            ArgoColor(hex: 0xAC5953),
            ArgoColor(hex: 0x4C944F),
            ArgoColor(hex: 0xB980D1),
            ArgoColor(hex: 0x318BAF),
            ArgoColor(hex: 0xB04F9D),
        ]), // Source code takes no ink from this palette: the evidence panel reads a patch in
        // Xcode's
        // own dark theme (`SyntaxTheme`).
        atlas: AtlasRoles(
            // A traffic light, and the one family here that knowingly sits inside the 0.25 held
            // between a hue and an operational state — the exemption is stated on `MeasureRoles`
            // and measured in `MeasureRampTests`.
            measure: MeasureRoles(
                quiet: ArgoColor(hex: 0x609884),
                middling: ArgoColor(hex: 0xBC9658),
                hot: ArgoColor(hex: 0xC26450),
            ),
            // Measured, not chosen: at 0.44 the worst case over every domain count from 2 to 40 is
            // 0.282 from anything else drawn on the map. See `DomainWheel`.
            domain: DomainWheel(
                saturationLeast: 0.14,
                saturationFull: 0.44,
                lightness: 0.47,
                turn: 137.508,
            ),
            materials: MaterialRoles(
                desktop: ArgoColor(hex: 0x0D0E10),
                plate1: ArgoColor(hex: 0x263138),
                plate2: ArgoColor(hex: 0x1E282E),
                plate3: ArgoColor(hex: 0x182127),
                fog: ArgoColor(hex: 0x1A3440),
                unassigned: ArgoColor(hex: 0x566068),
                hushed: ArgoColor(hex: 0x2E383F),
                // The text ramp's own quietest voice, spelled again rather than referenced: this
                // list is a table of values, and every other entry in it is one. The two are held
                // together by a claim rather than by a `var`.
                inferred: ArgoColor(hex: 0x929AA1),
            ),
        ),
    )
}
