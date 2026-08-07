/// The one implemented appearance: near-black graphite with Ion Blue.
///
/// Every neutral is a true grey with at most a few points of cool lift, so the shell reads
/// as graphite under glass rather than as navy. The lift is what keeps it from looking like
/// dead charcoal; anything more and the surfaces start to tint.
public extension ArgoPalette {
    static let graphite = ArgoPalette(
        surface: SurfaceRoles(
            sunken: ArgoColor(hex: 0x08090B),
            base: ArgoColor(hex: 0x0E0F11),
            raised: ArgoColor(hex: 0x16181B),
            overlay: ArgoColor(hex: 0x1F2124),
            glassTint: ArgoColor(hex: 0xFFFFFF, opacity: 0.06),
            hover: ArgoColor(hex: 0xFFFFFF, opacity: 0.045),
            selected: ArgoColor(hex: 0xFFFFFF, opacity: 0.085),
        ),
        text: TextRoles(
            primary: ArgoColor(hex: 0xF2F4F6),
            secondary: ArgoColor(hex: 0xA8AEB5),
            tertiary: ArgoColor(hex: 0x7E858C),
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
            idle: ArgoColor(hex: 0x7E868E),
            attention: ArgoColor(hex: 0xE8B24A),
            failure: ArgoColor(hex: 0xF2555C),
        ),
    )
}
