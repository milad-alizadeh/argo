import SwiftUI

/// A Turn thinking, drawn as one ion filament crossing the whole measure.
///
/// **Nothing is drawn at rest.** The line exists only where the ion is, and that is not a
/// flourish: `FeedMark.turnEnded(.endTurn)` already draws as a full-width hairline with no words,
/// so a resting track under this would read as the mark meaning the opposite.
///
/// **Edge to edge is the point.** The lane cancels `ArgoFeedRow.inset` and runs the full
/// `ArgoFeedRow.column`, because a signal about the whole column should touch both of its edges. It
/// is the one row in the feed that ignores the gutter. The lane clips, so the ion never spills into
/// the deck beyond the measure.
struct FeedWorkingThread: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            filament(across: proxy.size.width)
        }
        .frame(height: ArgoFeedRow.lineHeight)
        .clipped()
        .padding(.horizontal, -ArgoFeedRow.inset)
        .accessibilityElement()
        .accessibilityLabel(FeedMark.working.spoken)
        // The word left the screen; it must not leave the screen reader. A status region rather
        // than a live one: the claim stands for the whole wait instead of being announced again
        // each time the ion comes round.
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// The ion at its own length, translating across the lane. Only the TRANSFORM animates: moving
    /// a gradient's stops is not compositor-owned, and a blur on a moving element repaints every
    /// frame of a loop that never ends.
    private func filament(across lane: CGFloat) -> some View {
        let length = lane * ArgoFeedRow.workingThreadShare
        return Pass(length: length, glow: glow)
            .modifier(Travel(
                pass: ArgoMotion.working.resolved(reduceMotion: reduceMotion),
                length: length,
                parked: (lane - length) / 2,
            ))
    }

    /// With movement off the filament parks, so it glows a step lower — at full strength a still
    /// bar across the measure reads as a rule somebody drew rather than as work in flight.
    private var glow: Double {
        reduceMotion ? ArgoFeedRow.workingThreadStillGlow : ArgoElevation.bloom.opacity
    }
}

/// The filament and its glow as one piece, so both take the same transform. The glow is a second
/// copy blurred ONCE rather than a filter over a moving element.
private struct Pass: View {
    @Environment(\.argo) private var argo

    let length: CGFloat
    let glow: Double

    var body: some View {
        capsule
            .background {
                capsule
                    .blur(radius: ArgoElevation.bloom.blur)
                    .opacity(glow)
            }
    }

    private var capsule: some View {
        Capsule()
            .fill(argo.color.ion.pass)
            .frame(width: length, height: ArgoStroke.indicator)
    }
}

/// Where the pass sits along the lane, and what moves it there.
///
/// A modifier rather than state on the view: `onAppear` has to fire against a width the geometry
/// has already settled, and the offset is the one thing being animated.
private struct Travel: ViewModifier {
    /// The role's own answer, already resolved against Reduce Motion. `nil` means the loop is off
    /// and the filament holds `parked`.
    let pass: Animation?
    /// The filament's own length — the unit `ArgoFeedRow.workingThreadTravel` is stated in.
    let length: CGFloat
    /// Where it rests when nothing moves: the centre of the measure.
    let parked: CGFloat

    @State private var travelled = false

    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            .onAppear {
                guard let pass else { return }
                withAnimation(pass) { travelled = true }
            }
    }

    private var offset: CGFloat {
        guard pass != nil else { return parked }
        let travel = ArgoFeedRow.workingThreadTravel
        return (travelled ? travel.upperBound : travel.lowerBound) * length
    }
}

// The state a still cannot prove, here to be WATCHED: the ion has to cross the full 720 and fade
// out past both edges, with nothing left behind it.
#Preview("Working — the thread crossing the measure") {
    FeedWorkingThread()
        .padding(ArgoFeedRow.inset)
        .frame(width: ArgoFeedRow.column)
        .argoDeckSurface()
        .argoAppearance()
}

// The whole of Reduce Motion: parked at the centre, dimmer, and still reading as live.
#Preview("Working — the thread with movement off") {
    FeedWorkingThread()
        .padding(ArgoFeedRow.inset)
        .frame(width: ArgoFeedRow.column)
        .environment(\.argoStillsMotion, true)
        .argoDeckSurface()
        .argoAppearance()
}
