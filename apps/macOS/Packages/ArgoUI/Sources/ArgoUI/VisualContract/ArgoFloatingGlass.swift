import SwiftUI

/// The material a surface takes when it floats over the deck because of a state the reader is in.
///
/// D14's transient-surfaces clause, spelled once. A surface qualifies when it is present because
/// the reader is in a state — a reading that has stopped following, a plan being pointed at — and
/// absent otherwise; the furniture of the deck stays flat. Drawn in the same fill as the plane it
/// covers, a transient surface reads as part of the record, and the material is the only thing
/// that says otherwise.
///
/// One recipe rather than three call sites agreeing by hand: the clause admits a category, so
/// whatever floats over the deck next takes this and no new decision is made in a view.
struct ArgoFloatingGlass<Vessel: InsettableShape>: ViewModifier {
    @Environment(\.argo) private var argo
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.argoSuppressesTransparency) private var isSuppressed

    let vessel: Vessel

    func body(content: Content) -> some View {
        if reduceTransparency || isSuppressed {
            // The flat treatment these surfaces had before the clause, kept whole: a reader who
            // asked for no transparency gets a legible opaque surface, and nothing about the
            // control's shape, hit area or semantics moves with the material.
            content
                .background(argo.color.surface.overlay, in: vessel)
                .overlay {
                    vessel.strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
                }
                // The shadow comes back with the flat fill, because without the rim it is the only
                // thing left saying the surface is above the plane rather than drawn on it.
                .argoShadow(.popover)
        } else {
            content
                .glassEffect(.regular.tint(argo.color.surface.glassTint.color), in: vessel)
                // Re-judged against the material rather than kept by default: glass carries its
                // own specular rim, and a popover shadow under it stacks two depth cues on one
                // surface — which is the `vessel` rung, and what it was written for.
                .argoShadow(.vessel)
        }
    }
}

public extension EnvironmentValues {
    /// Reduce Transparency, forced on from inside the app.
    ///
    /// `accessibilityReduceTransparency` is read-only, and the fallback every glass surface has to
    /// prove is otherwise reachable only by changing System Settings on the machine taking the
    /// screenshot. This is what makes it a rendered state with a name. One direction only: nothing
    /// here can force transparency BACK on over a reader who asked for none.
    @Entry var argoSuppressesTransparency: Bool = false
}

public extension View {
    /// Draws this surface as a transient float over the deck — see `ArgoFloatingGlass`.
    func argoFloatingGlass(in vessel: some InsettableShape) -> some View {
        modifier(ArgoFloatingGlass(vessel: vessel))
    }

    /// Renders everything below as it is drawn for a reader who asked for no transparency.
    func argoWithoutTransparency(_ isSuppressed: Bool = true) -> some View {
        environment(\.argoSuppressesTransparency, isSuppressed)
    }
}
