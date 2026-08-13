import SwiftUI

/// The one keyboard cursor, drawn from the contract's own tokens. Hand-drawn rather than the
/// system's: `focusEffectDisabled()` is the only switch on that one, and it outlines the
/// FOCUSABLE, which is routinely a larger box than the thing that was focused (#533).
///
/// A shape rather than a view, so a caller that has to PLACE the ring — the feed, whose row
/// decides where its own cursor goes — strokes the same edge as one that just overlays it.
struct ArgoFocusRing: View {
    @Environment(\.argo) private var argo

    var radius = ArgoRadius.control

    var body: some View {
        RoundedRectangle(cornerRadius: radius)
            .strokeBorder(argo.color.interaction.focusRing, lineWidth: ArgoStroke.focus)
    }
}

private struct ArgoFocusRinged: ViewModifier {
    let isOn: Bool
    let radius: CGFloat

    func body(content: Content) -> some View {
        content.overlay {
            if isOn {
                ArgoFocusRing(radius: radius)
            }
        }
    }
}

extension View {
    /// The keyboard cursor around this view, on only while the keyboard is what the reader is
    /// working with. Pair it with `focusEffectDisabled()` on the focusable itself.
    @MainActor func argoFocusRing(
        _ isFocused: Bool,
        radius: CGFloat = ArgoRadius.control,
    )
        -> some View {
        modifier(ArgoFocusRinged(
            isOn: isFocused && ArgoFocusVisibility.shared.isOn,
            radius: radius,
        ))
    }
}
