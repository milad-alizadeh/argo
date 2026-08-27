import SwiftUI

/// The window's fixed chrome: ONE tinted blur from the window's top edge to the one hairline
/// where it stops.
///
/// One piece, not a band per zone. The window's title bar is hidden (`ArgoApp`) and the view
/// wearing this modifier extends through the safe area (`DeckCanopy`), so the one sheet reaches
/// the top of the WINDOW — the toolbar's icons, the Session's identity and the tab line all sit
/// on it together. Anything less read as two surfaces meeting: a titlebar in the way left the
/// icons on a strip no material of ours could reach, and matching its tone by eye is how the bar
/// got a step through its middle.
///
/// It is a blur and not `argoFloatingGlass`. A float is present BECAUSE the reader is in a state
/// (D14), so its specular rim earns its keep by saying "above the plane". Chrome is always there,
/// so the rim becomes an effect rather than information, and the only thing left worth drawing is
/// the boundary.
///
/// **The blur has to be `glassEffect` all the same, tint and rim off.** A SwiftUI `Material` and an
/// `NSVisualEffectView` both sample only what SwiftUI itself drew, and the feed is an
/// `NSTableView` — under either of those the reading stopped dead at the bar's bottom edge instead
/// of passing beneath it, which is the whole point of the bar. `.clear` is the rung that blurs
/// without lighting the surface.
struct ArgoChromeBar: ViewModifier {
    @Environment(\.argo) private var argo
    @Environment(\.colorSchemeContrast) private var contrast
    @Environment(\.argoIsFlat) private var isFlat

    func body(content: Content) -> some View {
        bar(content)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(edge)
                    .frame(height: ArgoStroke.hairline)
            }
    }

    /// How much of the bar's tint sits over the blur. `.clear` alone leaves the reading legible
    /// through the chrome and shows the glass refracting at its own bottom edge, which is the
    /// distracting half of the effect. The wash mutes both to a suggestion.
    private static let scrim: Double = 0.88

    /// How far the glass is drawn BELOW the bar before being clipped. It refracts a mirrored strip
    /// of the reading along its own bottom edge, and cutting that edge off out of sight is what
    /// leaves a plain blur behind. Wider than the refraction, which runs a few points.
    private static let overhang: CGFloat = 24

    /// The glass hangs DIRECTLY off the bar's own view, not off a shape inside a nested
    /// background — moved into one, it stopped sampling the AppKit layers and the bar went
    /// opaque. Blind-measured, not a guess: flat to within one luma where a row sat beneath.
    @ViewBuilder private func bar(_ content: Content) -> some View {
        if isFlat {
            content.background(argo.color.surface.base)
        } else {
            content
                .background(argo.color.surface.base.opacity(Self.scrim))
                .background {
                    Color.clear
                        .glassEffect(.clear, in: Rectangle())
                        .padding(.bottom, -Self.overhang)
                }
                .clipped()
        }
    }

    /// `subtle` and not `hairline`: this line divides the chrome from the deck, which are two
    /// different things — the tone that separates two panels of one surface goes missing here.
    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

extension View {
    /// Draws this bar as the window's fixed chrome — see `ArgoChromeBar`.
    func argoChromeBar() -> some View {
        modifier(ArgoChromeBar())
    }
}
