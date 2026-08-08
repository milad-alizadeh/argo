/// The one implemented appearance: near-black graphite with Ion Blue.
///
/// Every neutral is a true grey with at most a few points of cool lift, so the shell reads
/// as graphite under glass rather than as navy. The lift is what keeps it from looking like
/// dead charcoal; anything more and the surfaces start to tint.
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
            // Resolves to #2B2D31 over `base` — the study's selected row. The app's
            // `AccentColor` asset must carry the same value: the native sidebar capsule
            // reads that, never this.
            selected: ArgoColor(hex: 0xFFFFFF, opacity: 0.058),
        ),
        text: TextRoles(
            primary: ArgoColor(hex: 0xF2F4F6),
            secondary: ArgoColor(hex: 0xA8AEB5),
            // Lifted with the ramp: on the study's lighter deck the old value fell to
            // 4.36:1, under the 4.5 floor the contract asserts.
            tertiary: ArgoColor(hex: 0x868D94),
            disabled: ArgoColor(hex: 0x4E545A),
            onAccent: ArgoColor(hex: 0x05070A),
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
        ),
        state: StateRoles(
            running: ArgoColor(hex: 0x46D3A8),
            idle: ArgoColor(hex: 0x868E96),
            attention: ArgoColor(hex: 0xE8B24A),
            failure: ArgoColor(hex: 0xF2555C),
        ),
        // The study drew these as the running teal and the failure red, and said so as an open
        // gap: at a glance a `+8` then read as a live Session. Held apart here — a sage that is
        // nothing like the running signal, and a rose well off the failure red.
        diff: DiffRoles(
            added: ArgoColor(hex: 0xA9D18E),
            removed: ArgoColor(hex: 0xD98C93),
        ),
        // Source code takes no ink from this palette. The evidence panel reads a patch in Xcode's
        // own dark theme (`SyntaxTheme`) — the one surface where matching the editor the reader
        // already has open beats matching the shell around it.
    )
}
