import SwiftUI

/// The appearance in force. Only colour lives here: type, geometry, elevation and motion do
/// not change between a dark and a light appearance, so making them environment-dependent
/// would buy nothing and cost every call site a lookup.
///
/// Today there is exactly one value. A light appearance is a second `ArgoPalette` and a
/// write to this key — the structure is already in place, and no view changes.
public struct ArgoTheme: Sendable {
    public let color: ArgoPalette

    public init(color: ArgoPalette) {
        self.color = color
    }

    public static let graphite = ArgoTheme(color: .graphite)
}

public extension EnvironmentValues {
    @Entry var argo: ArgoTheme = .graphite
}

public extension View {
    func argoTheme(_ theme: ArgoTheme) -> some View {
        environment(\.argo, theme)
    }

    /// The window's ground rules: the graphite appearance, Ion Blue as the accent every
    /// native control tints itself with, and the dark scheme the palette is drawn for.
    ///
    /// It deliberately paints no background. The sidebar's Liquid Glass is the system's to
    /// draw, and a colour laid over the whole window is exactly what kills it.
    func argoAppearance(_ theme: ArgoTheme = .graphite) -> some View {
        argoTheme(theme)
            .tint(theme.color.interaction.accent.color)
            .foregroundStyle(theme.color.text.primary)
            .preferredColorScheme(.dark)
    }

    /// The opaque ground an Instrument Deck sits on. Only surfaces that are opaque by
    /// contract call this — never the window.
    func argoDeckSurface(_ theme: ArgoTheme = .graphite) -> some View {
        background(theme.color.surface.base)
    }
}
