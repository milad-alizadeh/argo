import ArgoDesign
import SwiftUI

/// The canonical state dot. It leads every roster row, including the rows whose state Argo
/// cannot establish: an outlined dot holds the column so titles stay on one x, and reads as
/// the honest `unknown` the tier rules owe rather than as a quiet `idle`.
///
/// `running` is the one state that MOVES (#1291, breathing since #1367). A Turn is the operation
/// D12 lets a live signal repeat for, and it is the only state with an operation to report —
/// movement is what the eye finds first, so a scanned roster answers "which rows are working"
/// before it is read.
struct SessionStateIndicator: View {
    @Environment(\.argo) private var argo

    /// How much wider than the dot the halo blurs, in the dot's own widths. Wider than the dot, or
    /// a blur at the dot's own size would sit entirely behind it and never read as light around it.
    private static let haloWidth: CGFloat = 1.7

    /// The floor of the breath, as a share of the rung's own glow (#1367). The floor is the
    /// point: a still turned off does not lose the light, it loses the movement — the halo parks
    /// here rather than at the whole of it or at nothing.
    private static let haloRestShare: Double = 0.4

    let state: ArgoOperationalState?
    /// When the Turn this dot is reporting began, where Argo owns that stamp. It is what the loop
    /// ages the pass off; `nil` leaves it ageing from the row's own first frame, which is all a
    /// Session Argo only observes has ever earned.
    var turnStartedAt: Date?

    var body: some View {
        Group {
            if let state {
                Circle()
                    .fill(state.tint(in: argo.color))
                    // BEHIND the dot: the halo is light around the dot, and the dot keeps its own
                    // ink whatever the breath is doing. A background takes no part in layout, so
                    // nothing here moves a title.
                    .background { halo(of: state) }
            } else {
                Circle().strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
            }
        }
        .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
        .accessibilityHidden(true)
    }

    /// One rise and fall IN PLACE, driven by `ArgoMotion.working` one pass at a time through the
    /// loop the feed's live surfaces already run off. The same blurred copy of the dot's own ink as
    /// the thread's filament, but never travelling: Argo's live surfaces are one family, and the
    /// roster does not grow a second clock, only its own idiom of the one loop.
    ///
    /// The period is `ArgoWaitAge`'s, read off `turnStartedAt`, so a dot on a Turn six minutes in
    /// breathes slower than one three seconds in and glows lower with it.
    ///
    /// Under Reduce Motion the loop stops and the halo parks at `haloRestShare` — a loop has no
    /// shorter answer, and a reader who turned movement off loses the movement, not the state.
    @ViewBuilder private func halo(of state: ArgoOperationalState) -> some View {
        if state == .running {
            FeedIonLoop { phase, aged in
                glow(of: state)
                    .modifier(HaloBreath(
                        phase: phase ?? 0,
                        rest: aged.glow * Self.haloRestShare,
                        full: aged.glow,
                    ))
            }
            // The loop ages the pass off this. Without it a window opened onto a Turn six minutes
            // in would breathe at the freshest rung, and scrolling the row off and back would
            // restart the wait — the two readings the feed can only degrade to and the roster
            // need not.
            .environment(\.argoWaitStarted, turnStartedAt)
        }
    }

    /// The light itself: the dot's own ink, blurred once. The same shape as
    /// `FeedWorkingThread`'s filament — a blurred copy that takes the transform, never a filter
    /// over a moving element, which repaints every frame of a loop that never ends.
    private func glow(of state: ArgoOperationalState) -> some View {
        let size = ArgoIconSize.statusDot * Self.haloWidth
        return Circle()
            .fill(state.tint(in: argo.color))
            .frame(width: size, height: size)
            .blur(radius: ArgoElevation.bloom.blur)
    }
}

/// The breath itself: one rise and fall across the pass, never a switch. `phase` — not the
/// opacity — is the animatable data, because a curve read only at a view body's two end values
/// interpolates linearly between them; a floor-to-floor curve evaluated only at its ends would
/// flatten to no animation at all. As a modifier, SwiftUI interpolates `phase` continuously along
/// the pass's own curve and re-evaluates `body(content:)` at each intermediate value.
private struct HaloBreath: ViewModifier {
    var phase: Double
    let rest: Double
    let full: Double

    var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func body(content: Content) -> some View {
        content.opacity(rest + (full - rest) * sin(phase * .pi))
    }
}

#Preview("State dot — the four states and the honest unknown") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ForEach(ArgoOperationalState.allCases, id: \.self) { SessionStateIndicator(state: $0) }
        SessionStateIndicator(state: nil)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}

// The half a still cannot carry: the running dot has to sit at its resting strength and the other
// three have to sit at theirs, in one frame, so the difference is watchable rather than asserted.
#Preview("State dot — the running dot with movement off") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ForEach(ArgoOperationalState.allCases, id: \.self) { SessionStateIndicator(state: $0) }
        SessionStateIndicator(state: nil)
    }
    .padding(ArgoSpacing.loose)
    .environment(\.argoStillsMotion, true)
    .argoDeckSurface()
    .argoAppearance()
}
