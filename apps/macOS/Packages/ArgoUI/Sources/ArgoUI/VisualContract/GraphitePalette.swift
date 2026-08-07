/// The one implemented appearance: near-black graphite with Ion Blue.
///
/// Every neutral is a true grey with at most a few points of cool lift, so the shell reads
/// as graphite under glass rather than as navy. The lift is what keeps it from looking like
/// dead charcoal; anything more and the surfaces start to tint.
public extension ArgoPalette {
    static let graphite = ArgoPalette(
        surface: SurfaceRoles(
            // Measured off the approved study rather than chosen: `#1E2024` is the tone the
            // whole image is built on (77k sampled pixels — deck, sidebar and rails all sit
            // on it), and `#191A1D` is its chrome band. The first pass set these a rung and
            // a half darker, which is what made the shell read as black next to the study.
            sunken: ArgoColor(hex: 0x191A1D),
            base: ArgoColor(hex: 0x1E2024),
            raised: ArgoColor(hex: 0x252729),
            overlay: ArgoColor(hex: 0x2E3136),
            glassTint: ArgoColor(hex: 0xFFFFFF, opacity: 0.06),
            hover: ArgoColor(hex: 0xFFFFFF, opacity: 0.045),
            // 0.058 over the corrected base resolves to #2B2D31 — the study's selected
            // roster row, taken as the dominant tone of the whole row band rather than off
            // one pixel. The app's `AccentColor` asset carries the same value, because the
            // native sidebar capsule reads that and not this.
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
    )
}
