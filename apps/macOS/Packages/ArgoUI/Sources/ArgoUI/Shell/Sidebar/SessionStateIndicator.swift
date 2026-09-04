import ArgoDesign
import SwiftUI

/// The canonical state dot. It leads every roster row, including the rows whose state Argo
/// cannot establish: an outlined dot holds the column so titles stay on one x, and reads as
/// the honest `unknown` the tier rules owe rather than as a quiet `idle`.
///
/// `running` is the one state that MOVES (#1291). A Turn is the operation D12 lets a live signal
/// repeat for, and it is the only state with an operation to report — movement is what the eye
/// finds first, so a scanned roster answers "which rows are working" before it is read.
struct SessionStateIndicator: View {
    @Environment(\.argo) private var argo

    /// The lane the glow crosses, in the dot's own widths — the same way `ArgoFeedRow` states the
    /// thread's travel, and for the same reason: the sweep is read against the thing it crosses.
    ///
    /// It reaches less than the gap to the title (`ArgoSpacing.snug`) on each side, so a pass
    /// leaving the dot dies in the gutter rather than washing the first letter of a name.
    private static let sweepLane: CGFloat = 2.5

    /// How big the travelling light is, in the same unit. Wider than the dot, or a pass sitting
    /// over the dot would be entirely behind it and the sweep would only ever show at its ends —
    /// measured on the render, where a light at the dot's own width read as a flicker.
    private static let sweepLight: CGFloat = 1.7

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
                    // BEHIND the dot, and wider than it: the glow is light crossing the dot, and
                    // the dot keeps its own ink whatever the pass is doing. A background takes no
                    // part in layout, so nothing here moves a title.
                    .background { sweep(of: state) }
            } else {
                Circle().strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
            }
        }
        .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
        .accessibilityHidden(true)
    }

    /// One pass of light ACROSS the dot, driven by `ArgoMotion.working` one pass at a time through
    /// the loop the feed's live surfaces already run off. The same sweep as the thread across the
    /// measure and the wash over a call in flight, at the width of a 6pt mark: a light that
    /// travels at one strength and leaves, never a ring that expands and dies. Argo's live surfaces
    /// are one family, and a second idiom on the roster would read as a second claim.
    ///
    /// The period is `ArgoWaitAge`'s, read off `turnStartedAt`, so a dot on a Turn six minutes in
    /// sweeps slower than one three seconds in and glows lower with it.
    ///
    /// Under Reduce Motion the loop stops and no light crosses at all — a loop has no shorter
    /// answer. The dot keeps its FULL running tint there, so the still still reads as running:
    /// what the reader loses is the movement, not the state.
    @ViewBuilder private func sweep(of state: ArgoOperationalState) -> some View {
        if state == .running {
            FeedIonLoop { phase, aged in
                if let phase {
                    glow(of: state)
                        .offset(x: travelled(to: phase))
                        .opacity(aged.glow)
                }
            }
            .frame(width: lane, height: lane)
            // The lane falls off in every direction, not just along the travel: a straight-edged
            // mask on a blurred thing cuts a visible band above and below the dot, which reads as
            // a drawn plate rather than as light.
            .mask { fade }
            // The loop ages the pass off this. Without it a window opened onto a Turn six minutes
            // in would sweep at the freshest rung, and scrolling the row off and back would restart
            // the wait — the two readings the feed can only degrade to and the roster need not.
            .environment(\.argoWaitStarted, turnStartedAt)
        }
    }

    /// The light itself: the dot's own ink, blurred once. The same shape as
    /// `FeedWorkingThread`'s filament — a blurred copy that takes the transform, never a filter
    /// over a moving element, which repaints every frame of a loop that never ends.
    private func glow(of state: ArgoOperationalState) -> some View {
        let size = ArgoIconSize.statusDot * Self.sweepLight
        return Circle()
            .fill(state.tint(in: argo.color))
            .frame(width: size, height: size)
            .blur(radius: ArgoElevation.bloom.blur)
    }

    /// Where along the lane the pass sits, measured from the dot. Both ends are a half-lane out, so
    /// the light enters and leaves rather than appearing on top of the dot.
    private func travelled(to phase: Double) -> CGFloat {
        (phase - 0.5) * lane
    }

    private var lane: CGFloat {
        ArgoIconSize.statusDot * Self.sweepLane
    }

    /// Full strength over the dot and gone by the lane's edge, so a pass gathers as it arrives and
    /// dies as it leaves without an edge anywhere for the eye to catch.
    private var fade: some View {
        RadialGradient(
            gradient: Gradient(stops: [
                .init(color: .white, location: 0.5),
                .init(color: .clear, location: 1),
            ]),
            center: .center,
            startRadius: 0,
            endRadius: lane / 2,
        )
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

// The half a still cannot carry: light has to cross the running dot and the other three have to sit
// there, in one frame, so the difference is watchable rather than asserted.
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
