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

    /// How big the glow is, in the dot's own widths. Wider than the dot, or the light would be
    /// entirely behind it — measured on the render, where a glow at the dot's own width read as a
    /// flicker. It stays inside the gap to the title (`ArgoSpacing.base`), so the halo dies in the
    /// gutter rather than washing the first letter of a name.
    private static let glowSpread: CGFloat = 1.7

    /// The share of the rung's glow the breath never goes below. The light rises and falls; it does
    /// not switch. A halo that reached zero would read as a blink, which says a Turn started and
    /// stopped rather than one that is running.
    private static let restingGlow: Double = 0.4

    let state: ArgoOperationalState?
    /// When the Turn this dot is reporting began, where Argo owns that stamp. It is what the loop
    /// ages the breath off; `nil` leaves it ageing from the row's own first frame, which is all a
    /// Session Argo only observes has ever earned.
    var turnStartedAt: Date?

    var body: some View {
        Group {
            if let state {
                Circle()
                    .fill(state.tint(in: argo.color))
                    // BEHIND the dot, and wider than it: the glow is light around the dot, and the
                    // dot keeps its own ink whatever the breath is doing. A background takes no
                    // part in layout, so nothing here moves a title.
                    .background { breath(of: state) }
            } else {
                Circle().strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
            }
        }
        .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
        .accessibilityHidden(true)
    }

    /// The dot BREATHING: one rise and fall of the halo per pass of `ArgoMotion.working`, through
    /// the loop the feed's live surfaces already run off. Argo's live surfaces are one family, and
    /// a second clock on the roster would read as a second claim.
    ///
    /// The period is `ArgoWaitAge`'s, read off `turnStartedAt`, so a dot on a Turn six minutes in
    /// breathes slower than one three seconds in and glows lower with it.
    ///
    /// Under Reduce Motion the loop stops and the halo parks at its resting strength: the still is
    /// the breath's own floor, so a reader who turned movement off loses the movement, not the
    /// state.
    @ViewBuilder private func breath(of state: ArgoOperationalState) -> some View {
        if state == .running {
            FeedIonLoop { phase, aged in
                glow(of: state)
                    .modifier(BreathingGlow(
                        phase: phase ?? 0,
                        peak: aged.glow,
                        resting: Self.restingGlow,
                        isStill: phase == nil,
                    ))
            }
            // The loop ages the breath off this. Without it a window opened onto a Turn six
            // minutes in would breathe at the freshest rung, and scrolling the row off and back
            // would restart the wait.
            .environment(\.argoWaitStarted, turnStartedAt)
        }
    }

    /// The light itself: the dot's own ink, blurred once. The same shape as `FeedWorkingThread`'s
    /// filament — a blurred copy, never a filter over a moving element, which repaints every frame
    /// of a loop that never ends.
    private func glow(of state: ArgoOperationalState) -> some View {
        let size = ArgoIconSize.statusDot * Self.glowSpread
        return Circle()
            .fill(state.tint(in: argo.color))
            .frame(width: size, height: size)
            .blur(radius: ArgoElevation.bloom.blur)
    }
}

/// One breath of the halo, as a function of the loop's phase.
///
/// `Animatable` is the whole point. SwiftUI interpolates a modifier's `animatableData` and rebuilds
/// its body at each step, so the curve below is evaluated ALONG the pass. An opacity computed in a
/// view body would instead be interpolated between its two end values, and a curve that starts and
/// ends in the same place would not animate at all.
private struct BreathingGlow: ViewModifier, Animatable {
    var phase: Double
    /// The rung's own glow, which is the strength at the top of the breath.
    let peak: Double
    /// The share of `peak` the bottom of the breath holds.
    let resting: Double
    /// Whether movement is off, in which case the halo parks at the bottom of the breath.
    let isStill: Bool

    /// `nonisolated` because `ViewModifier` is main-actor isolated and `Animatable` is not:
    /// SwiftUI interpolates this off the main actor, and the conformance does not compile without
    /// saying so.
    nonisolated var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func body(content: Content) -> some View {
        content.opacity(peak * (isStill ? resting : strength))
    }

    /// A cosine rise and fall over the pass: `resting` at both ends, full in the middle. Equal ends
    /// are what makes the loop's re-entry invisible — the phase snaps back to 0 between passes, and
    /// a curve that did not close would snap the light with it.
    private var strength: Double {
        let rise = (1 - cos(2 * .pi * phase)) / 2
        return resting + (1 - resting) * rise
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

// The half a still cannot carry: the running dot has to breathe and the other three have to sit
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
