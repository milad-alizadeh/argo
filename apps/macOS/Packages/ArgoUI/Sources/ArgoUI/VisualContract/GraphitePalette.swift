/// The one implemented appearance: near-black graphite with Ion Blue.
///
/// Every neutral is a true grey with at most a few points of cool lift, so the shell reads
/// as graphite under glass rather than as navy. The lift is what keeps it from looking like
/// dead charcoal; anything more and the surfaces start to tint.
public extension ArgoPalette {
    static let graphite = ArgoPalette(
        surface: SurfaceRoles(
            sunken: ArgoColor(hex: 0x0809_0B),
            base: ArgoColor(hex: 0x0E0F_11),
            raised: ArgoColor(hex: 0x1618_1B),
            overlay: ArgoColor(hex: 0x1F21_24),
            glassTint: ArgoColor(hex: 0xFFFF_FF, opacity: 0.06),
            hover: ArgoColor(hex: 0xFFFF_FF, opacity: 0.045),
            selected: ArgoColor(hex: 0xFFFF_FF, opacity: 0.085)
        ),
        text: TextRoles(
            primary: ArgoColor(hex: 0xF2F4_F6),
            secondary: ArgoColor(hex: 0xA8AE_B5),
            tertiary: ArgoColor(hex: 0x7E85_8C),
            disabled: ArgoColor(hex: 0x4E54_5A),
            onAccent: ArgoColor(hex: 0x0507_0A)
        ),
        edge: EdgeRoles(
            hairline: ArgoColor(hex: 0xFFFF_FF, opacity: 0.08),
            subtle: ArgoColor(hex: 0xFFFF_FF, opacity: 0.13),
            strong: ArgoColor(hex: 0xFFFF_FF, opacity: 0.22),
            glassRim: ArgoColor(hex: 0xFFFF_FF, opacity: 0.30)
        ),
        interaction: InteractionRoles(
            accent: ArgoColor(hex: 0x3E9B_FF),
            accentBright: ArgoColor(hex: 0x6FB6_FF),
            accentDeep: ArgoColor(hex: 0x1E6F_D4),
            selectionIndicator: ArgoColor(hex: 0x3E9B_FF),
            focusRing: ArgoColor(hex: 0x6FB6_FF)
        ),
        state: StateRoles(
            running: ArgoColor(hex: 0x46D3_A8),
            idle: ArgoColor(hex: 0x7E86_8E),
            attention: ArgoColor(hex: 0xE8B2_4A),
            failure: ArgoColor(hex: 0xF255_5C)
        )
    )
}
