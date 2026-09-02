import ArgoDesign
import SwiftUI

/// A Turn thinking, drawn as one ion filament crossing the whole measure.
///
/// **Nothing is drawn at rest.** The line exists only where the ion is, and that is not a
/// flourish: `FeedMark.turnEnded(.endTurn)` already draws as a full-width hairline with no words,
/// so a resting track under this would read as the mark meaning the opposite.
///
/// The lane is the zone's full width — `FeedTableModel` holds this one row to no gutter and no
/// measure, so the ion runs edge to edge and exits at the minimap's seam. It clips, so the ion
/// never spills into the rows above and below it.
struct FeedWorkingThread: View {
    var body: some View {
        GeometryReader { proxy in
            // Centred in the lane rather than at its head: a `GeometryReader` aligns its content
            // top-leading, which would sit a 2pt filament on the ceiling of a 20pt row.
            filament(across: proxy.size.width)
                .frame(maxHeight: .infinity, alignment: .center)
        }
        .frame(height: ArgoFeedRow.lineHeight)
        .clipped()
        .accessibilityElement()
        .accessibilityLabel(FeedMark.working.spoken)
        // The word left the screen; it must not leave the screen reader. The trait says the row
        // changes under its own steam, so the label is not re-announced each pass.
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// The ion at its own length, translating across the lane. Only the TRANSFORM animates: moving
    /// a gradient's stops is not compositor-owned, and a blur on a moving element repaints every
    /// frame of a loop that never ends.
    private func filament(across lane: CGFloat) -> some View {
        let length = lane * ArgoFeedRow.workingThreadShare
        let parked = (lane - length) / 2
        return FeedIonLoop { phase, aged in
            Filament(length: length, glow: glow(at: phase, aged: aged))
                .offset(x: phase.map { travelled(to: $0, at: length) } ?? parked)
        }
    }

    /// Where along the lane the pass sits at this point in it. Stated in the filament's OWN
    /// lengths, so both ends clear the measure whatever the window is doing.
    private func travelled(to phase: Double, at length: CGFloat) -> CGFloat {
        let travel = ArgoFeedRow.workingThreadTravel
        return (travel.lowerBound + (travel.upperBound - travel.lowerBound) * phase) * length
    }

    /// With movement off the filament parks, so it glows a step lower — at full strength a still
    /// bar across the measure reads as a rule somebody drew rather than as work in flight. The
    /// still does NOT vary by age: a parked bar is no reading of how long the wait has run.
    private func glow(at phase: Double?, aged: ArgoWaitAge) -> Double {
        phase == nil ? ArgoFeedRow.workingThreadStillGlow : aged.glow
    }
}

/// The filament and its glow as one piece, so both take the same transform. The glow is a second
/// copy blurred ONCE rather than a filter over a moving element.
private struct Filament: View {
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

// The state a still cannot prove, here to be WATCHED: the ion has to cross the full 720 and fade
// out past both edges, with nothing left behind it.
#Preview("Working — the thread crossing the measure") {
    FeedWorkingThread()
        .frame(width: ArgoFeedRow.column)
        .argoDeckSurface()
        .argoAppearance()
}

// The other thing a still cannot prove: the period. Three ages at once, so the slowing is watchable
// side by side instead of over six minutes.
#Preview("Working — the same thread at three ages") {
    VStack(spacing: ArgoFeedRow.gap) {
        ForEach([0.0, 90.0, 360.0], id: \.self) { age in
            FeedWorkingThread().environment(\.argoAgesWait, age)
        }
    }
    .frame(width: ArgoFeedRow.column)
    .argoDeckSurface()
    .argoAppearance()
}

// The whole of Reduce Motion: parked at the centre, dimmer, and still reading as live.
#Preview("Working — the thread with movement off") {
    FeedWorkingThread()
        .frame(width: ArgoFeedRow.column)
        .environment(\.argoStillsMotion, true)
        .argoDeckSurface()
        .argoAppearance()
}
