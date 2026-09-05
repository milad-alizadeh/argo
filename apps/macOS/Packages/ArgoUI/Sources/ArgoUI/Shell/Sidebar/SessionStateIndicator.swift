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

    let state: ArgoOperationalState?

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

    /// The dot BREATHING: one rise and fall of the halo per pass of `ArgoMotion.working`, on the
    /// pass its surface is already under. Argo's live surfaces are one family, and a second clock
    /// on the roster would read as a second claim.
    ///
    /// The period is `ArgoWaitAge`'s, off the stamp the pass was opened with, so a dot on a Turn
    /// six minutes in breathes slower than one three seconds in and glows lower with it. On the
    /// roster that stamp is the row's (`SharedIonPass` in `SessionRow`); a dot drawn anywhere else
    /// ages from its own first frame, which is all a Session Argo only observes has ever earned.
    ///
    /// It parks at the breath's own floor with movement off: a halo is light AROUND the dot, and
    /// the dot keeps its ink whatever the breath does, so a reader who turned movement off loses
    /// the movement and not the state.
    @ViewBuilder private func breath(of state: ArgoOperationalState) -> some View {
        if state == .running {
            BreathingMark(parkedAt: BreathingGlow.resting, peak: \.glow) { glow(of: state) }
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
