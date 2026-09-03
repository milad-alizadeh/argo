import ArgoDesign
import SwiftUI

/// The indeterminate activity indicator the deck's provisional state gains once the wait has run
/// past `ArgoMotion.unreadDelay` — ADR-0030 Rule 3, and the status vocabulary as amended.
///
/// It says one thing and one thing only: Argo is still working. There is nothing to be determinate
/// ABOUT — a settled document is complete or absent, and a progress bar over a measure that
/// publishes nothing until it finishes would be a number invented to fill a bar.
///
/// The same ion as the feed's other live surfaces, at a fraction of the width and under the word
/// rather than across the measure. `FeedWorkingThread` is a claim about the SESSION — the agent is
/// thinking — and this is a claim about ARGO; two live surfaces that looked alike would be read as
/// one claim (`CONTEXT.md` · Honesty tier). Quieter for the same reason: this is Argo reporting its
/// own work to somebody who is waiting on it, not the reading coming alive.
struct FeedReadingIon: View {
    @Environment(\.argo) private var argo

    var body: some View {
        FeedIonLoop { phase, _ in
            capsule
                .offset(x: phase.map(travelled(to:)) ?? parked)
        }
        .frame(
            width: ArgoFeedRow.readingIonLane,
            height: ArgoStroke.indicator,
            alignment: .leading,
        )
        .clipped()
        .accessibilityElement()
        .accessibilityLabel(FeedVacancy.unread.words)
        // The trait says the surface changes under its own steam, so the label is not re-announced
        // once a pass — see `FeedWorkingThread`, which says the same thing for the same reason.
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// A MARK and not a voice, which is the whole of why it is the rule ink rather than a text
    /// rung. Measured on the render: at `text.disabled` it was the word's own colour exactly, and a
    /// short bar in the text's ink under the text reads as an underline.
    ///
    /// Not the accent either — that is the ion the SESSION's live surfaces are drawn in, and this
    /// wait is Argo's own (`CONTEXT.md` · Honesty tier).
    private var capsule: some View {
        Capsule()
            .fill(argo.color.edge.subtle)
            .frame(width: ArgoFeedRow.readingIonLength, height: ArgoStroke.indicator)
    }

    /// Where along the lane the pass sits at this point in it, in the ion's OWN lengths — the same
    /// arithmetic and the same reason as the working thread's: both ends clear the lane, so the ion
    /// enters and leaves rather than appearing mid-air.
    private func travelled(to phase: Double) -> CGFloat {
        let travel = ArgoFeedRow.readingIonTravel
        return (travel.lowerBound + (travel.upperBound - travel.lowerBound) * phase)
            * ArgoFeedRow.readingIonLength
    }

    /// With movement off the ion parks in the middle of its lane. It is still drawn, because its
    /// absence is the other state this surface has and the two may not look alike.
    private var parked: CGFloat {
        (ArgoFeedRow.readingIonLane - ArgoFeedRow.readingIonLength) / 2
    }
}

#Preview("Reading ion — Argo measuring a Session") {
    VStack(spacing: ArgoSpacing.snug) {
        Text(FeedVacancy.unread.words)
        FeedReadingIon()
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
