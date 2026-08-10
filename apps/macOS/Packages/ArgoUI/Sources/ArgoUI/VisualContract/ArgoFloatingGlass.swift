import SwiftUI

/// The material a surface takes when it floats over the deck because of a state the reader is in.
///
/// D14's transient-surfaces clause, spelled once. A surface qualifies when it is present because
/// the reader is in a state — a reading that has stopped following, a plan being pointed at — and
/// absent otherwise; the furniture of the deck stays flat. One recipe rather than three call sites
/// agreeing by hand: the clause admits a category, so whatever floats over the deck next takes
/// this and no new decision is made in a view.
///
/// Two settings take the material away, and the surface has to survive both. Reduce Transparency
/// is the one D21 names; Increased Contrast lands here too, because a translucent ground refracting
/// the reading behind it is a contrast problem however restrained the tint is. Neither changes the
/// control's shape, hit area, semantics or keyboard behaviour — nothing here is load-bearing.
struct ArgoFloatingGlass<Vessel: InsettableShape>: ViewModifier {
    @Environment(\.argo) private var argo
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast
    @Environment(\.argoSuppressesTransparency) private var isSuppressed

    let vessel: Vessel
    /// The state the surface is present BECAUSE of, when it is one worth wearing on the edge — the
    /// amber a Permission vessel takes. A parameter and not a second modifier at the call site, so
    /// the flat fallback swaps its neutral edge for this one instead of stacking two strokes on
    /// one boundary.
    let rim: ArgoColor?

    func body(content: Content) -> some View {
        if isFlat {
            content
                .background(argo.color.surface.overlay, in: vessel)
                .overlay { vessel.strokeBorder(rim ?? edge, lineWidth: ArgoStroke.border) }
                // Without a rim, the shadow is the only thing left saying the surface is above the
                // plane rather than drawn on it.
                .argoShadow(.popover)
        } else {
            // `vessel` is the no-shadow rung: the specular rim is the depth cue, and a popover
            // shadow under it would stack two of them on one surface.
            content
                .glassEffect(.regular.tint(argo.color.surface.glassTint.color), in: vessel)
                .overlay { rim.map { vessel.strokeBorder($0, lineWidth: ArgoStroke.border) } }
                .argoShadow(.vessel)
        }
    }

    private var isFlat: Bool {
        reduceTransparency || isSuppressed || contrast == .increased
    }

    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

extension EnvironmentValues {
    /// Reduce Transparency, forced on from inside the app.
    ///
    /// The system's own flag is read-only, so the fallback every glass surface has to prove would
    /// otherwise be reachable only by changing System Settings on whichever machine took the
    /// screenshot. This is what makes it a rendered state with a name. One direction only: nothing
    /// here can force transparency BACK on over a reader who asked for none.
    @Entry var argoSuppressesTransparency: Bool = false
}

extension View {
    /// Draws this surface as a transient float over the deck — see `ArgoFloatingGlass`.
    func argoFloatingGlass(in vessel: some InsettableShape, rim: ArgoColor? = nil) -> some View {
        modifier(ArgoFloatingGlass(vessel: vessel, rim: rim))
    }

    /// Renders everything below as it is drawn for a reader who asked for no transparency.
    func argoWithoutTransparency(_ isSuppressed: Bool = true) -> some View {
        environment(\.argoSuppressesTransparency, isSuppressed)
    }
}
