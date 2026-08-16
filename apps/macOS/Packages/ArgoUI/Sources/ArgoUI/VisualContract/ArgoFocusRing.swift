import SwiftUI

/// The one keyboard cursor, drawn from the contract's own tokens. Hand-drawn rather than the
/// system's: `focusEffectDisabled()` is the only switch on that one, and it outlines the
/// FOCUSABLE, which is routinely a larger box than the thing that was focused (#533).
///
/// Reachable as a view, so a caller that has to PLACE the ring — the feed, whose row decides where
/// its own cursor goes — strokes the same edge as one that just overlays it.
///
/// Generic over that edge, because a ring has to trace the control it is around: a capsule pill
/// ringed by a rounded rectangle shows daylight at all four corners.
struct ArgoFocusRing<Edge: InsettableShape>: View {
    @Environment(\.argo) private var argo

    private let edge: Edge

    init(_ edge: Edge) {
        self.edge = edge
    }

    init(radius: CGFloat = ArgoRadius.control) where Edge == RoundedRectangle {
        self.edge = RoundedRectangle(cornerRadius: radius)
    }

    var body: some View {
        edge.strokeBorder(argo.color.interaction.focusRing, lineWidth: ArgoStroke.focus)
    }
}

private struct ArgoFocusRinged<Edge: InsettableShape>: ViewModifier {
    let isOn: Bool
    let edge: Edge

    func body(content: Content) -> some View {
        content.overlay {
            if isOn {
                ArgoFocusRing(edge)
            }
        }
    }
}

extension View {
    /// The keyboard cursor around this view, on only while the keyboard is what the reader is
    /// working with. `ArgoApp` turns the system effect off for the whole window, so pair this with
    /// `focusEffectDisabled()` only where a `#Preview` has to draw the same state.
    @MainActor func argoFocusRing(
        _ isFocused: Bool,
        radius: CGFloat = ArgoRadius.control,
    )
        -> some View {
        argoFocusRing(isFocused, in: RoundedRectangle(cornerRadius: radius))
    }

    /// The same cursor around a control that is not a rounded rectangle.
    @MainActor func argoFocusRing(
        _ isFocused: Bool,
        in edge: some InsettableShape,
    )
        -> some View {
        modifier(ArgoFocusRinged(
            isOn: isFocused && ArgoFocusVisibility.shared.isOn,
            edge: edge,
        ))
    }
}
