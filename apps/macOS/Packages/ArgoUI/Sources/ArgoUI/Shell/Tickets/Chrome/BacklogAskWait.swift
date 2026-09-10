import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The pulse and its sentence, while a model reads (#1317).
///
/// **A bar and not a spinner**, because it sits inline in a sentence and a spinner beside words
/// reads as the words loading. `ArgoMotion.working` is the token for an indeterminate wait, and
/// the bar takes its period rather than one of its own.
///
/// **The wait is long.** #1315 measured four to eleven seconds over a real listing (ADR-0031), so
/// this is where the reader spends most of the interaction — which is why the surface says what is
/// being read rather than that something is happening, and why the Stop beside it is not optional.
/// Anything past a frame that cannot be stopped is a hang.
struct BacklogAskWait: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// How many tickets are being read. Named rather than counted vaguely: the reader who knows it
    /// saw all twelve knows a miss is a miss and not a gap in what was fetched.
    let reads: Int

    /// Where the lit run sits along the bar, as a share of it. Driven from `false` to `true` on
    /// appear so the animation has two values to run between — a `@State` scalar a static view
    /// never writes animates nothing.
    @State private var travelled = false

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            bar
            // Not "open tickets", which the design drew: the listing is the OPEN VIEW's, and
            // `Closed` is one of the five (#1075). A wait that called them open would be wrong in
            // that view and there is nothing on screen to correct it.
            Text("Reading \(reads) tickets…")
                .argoLine(ArgoTypography.body, .metadata)
        }
        .accessibilityElement(children: .combine)
    }

    private var bar: some View {
        Capsule()
            .fill(argo.color.edge.subtle.color)
            .frame(width: Self.barWidth, height: Self.barHeight)
            .overlay(alignment: .leading) { run }
            .clipShape(Capsule())
    }

    /// The lit run crossing the bar. It starts fully off the leading edge and ends fully off the
    /// trailing one, so neither end of the travel is drawn as a stop.
    ///
    /// **With movement off it does not travel, and it does not vanish either.** `ArgoMotion
    /// .working` has no reduced answer — a loop has no shorter one — so the offset would land on
    /// whichever end it was heading for and the bar would draw as an empty rule. A still has to
    /// still read as live, so the run parks at rest instead: same ink, same share, no travel.
    private var run: some View {
        Capsule()
            .fill(argo.color.interaction.accent.color)
            .frame(width: Self.barWidth * Self.runShare)
            .offset(x: reduceMotion ? Self.restingOffset : travelling)
            .animation(ArgoMotion.working.resolved(reduceMotion: reduceMotion), value: travelled)
            .onAppear { travelled = true }
    }

    /// Where the run sits on the bar during the pass — off the leading edge, then off the
    /// trailing one.
    private var travelling: CGFloat {
        travelled ? Self.barWidth : -Self.barWidth * Self.runShare
    }

    /// The bar's own measurements, beside the surface per `apps/macOS/AGENTS.md`: a measure is not
    /// a token. `40 × 2` is what the design names, and the run is the share of it the prototype's
    /// keyframes travel.
    static let barWidth: CGFloat = 40
    static let barHeight: CGFloat = 2
    static let runShare: CGFloat = 0.4
    /// Where the run stands when nothing may move it. On the bar rather than off either end, so
    /// the still reads as a wait in progress and not as an empty rule.
    static let restingOffset: CGFloat = barWidth * (1 - runShare) / 2
}

#Preview("Backlog ask wait") {
    BacklogAskWait(reads: 12)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
