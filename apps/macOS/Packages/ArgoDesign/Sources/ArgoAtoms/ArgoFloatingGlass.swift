import ArgoDesign
import SwiftUI

/// The material a surface takes when it floats over the deck rather than sitting in it.
///
/// Two kinds of surface qualify. A transient one is present because the reader is in a state and
/// absent otherwise (D14). A fixed one is always there but the content passes beneath it — the
/// deck's canopy, on D10's amendment of 2026-08-12.
///
/// Two settings take the material away and the surface has to survive both: Reduce Transparency
/// (D21) and Increased Contrast. Neither changes the control's shape, hit area, semantics or
/// keyboard behaviour.
struct ArgoFloatingGlass<Vessel: InsettableShape>: ViewModifier {
    @Environment(\.argo) private var argo
    @Environment(\.colorSchemeContrast) private var contrast
    @Environment(\.argoIsFlat) private var isFlat

    let vessel: Vessel
    /// The state the surface is present BECAUSE of, worn on the edge — the amber a Permission
    /// vessel takes. A parameter rather than a second modifier, so the flat fallback swaps its
    /// neutral edge for this one instead of stacking two strokes on one boundary.
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

    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

public extension EnvironmentValues {
    /// Reduce Transparency, forced on from inside the app: the system's own flag is read-only, so
    /// the flat fallback would otherwise be renderable only by changing System Settings. One
    /// direction only — nothing here can force transparency BACK on over a reader who asked for
    /// none.
    @Entry var argoSuppressesTransparency: Bool = false

    /// Whether optical material is off for this reader. Read it rather than the three flags: two
    /// surfaces that answered this differently would show a seam exactly where the setting meant
    /// to remove one.
    var argoIsFlat: Bool {
        accessibilityReduceTransparency
            || argoSuppressesTransparency
            || colorSchemeContrast == .increased
    }
}

public extension View {
    /// Draws this surface as a float over the deck — see `ArgoFloatingGlass`.
    func argoFloatingGlass(in vessel: some InsettableShape, rim: ArgoColor? = nil) -> some View {
        modifier(ArgoFloatingGlass(vessel: vessel, rim: rim))
    }

    /// Renders everything below as it is drawn for a reader who asked for no transparency.
    func argoWithoutTransparency(_ isSuppressed: Bool = true) -> some View {
        environment(\.argoSuppressesTransparency, isSuppressed)
    }
}
