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

    /// How far the halo reaches by the end of a pass, in multiples of the dot's own width. It
    /// starts AT the dot, so the reset between two passes happens entirely under the dot and is
    /// never seen — the same reason `FeedIonLoop`'s ion parks both ends of its travel off the lane.
    private static let haloReach: CGFloat = 3

    let state: ArgoOperationalState?

    var body: some View {
        Group {
            if let state {
                Circle()
                    .fill(state.tint(in: argo.color))
                    // BEHIND the dot, and outside its frame at every scale past 1: the halo is
                    // light coming off the dot, and the dot keeps its own ink whatever the pass
                    // is doing. Nothing here changes the frame, so no title moves.
                    .background { halo(of: state) }
            } else {
                Circle().strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
            }
        }
        .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
        .accessibilityHidden(true)
    }

    /// The pulse, driven by `ArgoMotion.working` one pass at a time through the loop the feed's
    /// live surfaces already run off. The period is the ladder's, so a dot on a Turn six minutes
    /// in beats slower than one three seconds in, and the glow cools with it.
    ///
    /// Under Reduce Motion the loop stops and there is no halo at all — a loop has no shorter
    /// answer. The dot keeps its FULL running tint there, so the still still reads as running:
    /// what the reader loses is the movement, not the state.
    @ViewBuilder private func halo(of state: ArgoOperationalState) -> some View {
        if state == .running {
            FeedIonLoop { phase, aged in
                if let phase {
                    Circle()
                        .fill(state.tint(in: argo.color))
                        .scaleEffect(1 + (Self.haloReach - 1) * phase)
                        // Gone by the end of the pass, so the ring reads as light spreading and
                        // dying rather than as a second dot orbiting the first.
                        .opacity(aged.glow * (1 - phase))
                        // After the scale, or the blur would grow with the ring and the halo
                        // would soften as it faded instead of only fading.
                        .blur(radius: ArgoElevation.bloom.blur)
                }
            }
        }
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

// The half a still cannot carry: the running dot has to beat and the other three have to sit
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
