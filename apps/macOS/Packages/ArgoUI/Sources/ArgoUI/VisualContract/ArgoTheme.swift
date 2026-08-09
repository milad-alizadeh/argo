import SwiftUI

/// The appearance in force. Only colour lives here: type, geometry, elevation and motion do
/// not change between a dark and a light appearance, so making them environment-dependent
/// would buy nothing and cost every call site a lookup.
///
/// Today there is exactly one value. A light appearance is a second `ArgoPalette` paired with
/// its `scheme` and a write to this key — the structure is already in place, and no view changes.
public struct ArgoTheme: Sendable {
    public let color: ArgoPalette
    /// Which scheme the palette is drawn FOR, so the system draws its own controls, menus and
    /// scrollbars to match.
    ///
    /// Carried beside the palette rather than hard-coded at the one place that applies it: the
    /// two are a single decision, and a light palette shipped under a `.dark` scheme would put
    /// dark native controls on a light shell — the one mismatch no palette value can fix.
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
    /// Every one of the four reads off the theme, so switching appearance is a single write and
    /// not a sweep through the call sites that used to spell `.dark` themselves.
    ///
    /// It deliberately paints no background. The sidebar's Liquid Glass is the system's to
    /// draw, and a colour laid over the whole window is exactly what kills it.
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
