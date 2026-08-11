import SwiftUI

/// The appearance in force. Only colour lives here: type, geometry, elevation and motion do not
/// change between a dark and a light appearance.
public struct ArgoTheme: Sendable {
    public let color: ArgoPalette
    /// Which scheme the palette is drawn FOR, so the system draws its own controls, menus and
    /// scrollbars to match. Carried beside the palette because the two are a single decision: a
    /// light palette under a `.dark` scheme is a mismatch no palette value can fix.
    public let scheme: ColorScheme

    public init(color: ArgoPalette, scheme: ColorScheme) {
        self.color = color
        self.scheme = scheme
    }

    public static let graphite = ArgoTheme(color: .graphite, scheme: .dark)
}

public extension EnvironmentValues {
    @Entry var argo: ArgoTheme = .graphite
}

public extension View {
    func argoTheme(_ theme: ArgoTheme) -> some View {
        environment(\.argo, theme)
    }

    /// The window's ground rules: the appearance, Ion Blue as the accent every native control
    /// tints itself with, and the scheme that appearance is drawn for.
    ///
    /// It deliberately paints NO background: the sidebar's Liquid Glass is the system's to draw,
    /// and a colour laid over the whole window kills it.
    func argoAppearance(_ theme: ArgoTheme = .graphite) -> some View {
        argoTheme(theme)
            .tint(theme.color.interaction.accent.color)
            .foregroundStyle(theme.color.text.primary)
            .preferredColorScheme(theme.scheme)
    }

    /// The opaque ground an Instrument Deck sits on. Only surfaces that are opaque by
    /// contract call this — never the window.
    func argoDeckSurface(_ theme: ArgoTheme = .graphite) -> some View {
        background(theme.color.surface.base)
    }
}
