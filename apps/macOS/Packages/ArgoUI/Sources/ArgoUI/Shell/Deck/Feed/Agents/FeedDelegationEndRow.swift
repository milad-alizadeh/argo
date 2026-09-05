import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// A delegation that came back, drawn as one settled line (#1281).
///
/// A CALL row's shape, because that is what the reading already spends on "a thing that happened":
/// the mark column, the verb and the subject on the same verticals the `Delegated` row above set
/// them on, and what it took in machine type at the quietest rung.
///
/// The two figures are the ones the record holds and no others — what the run took and what it
/// spent. Either is absent where the record priced or timed nothing, which is every backgrounded
/// Agent (#908): the slot stays empty rather than drawing a `0` that would claim the work was
/// instant or free.
///
/// A failure is drawn as `FeedCallLine` draws a call that failed — the whole line in the failure
/// ink, with the words unchanged. The Subagent DID come back; how it went is the colour, and for a
/// reader who cannot see it, the accessibility label.
///
/// One line, whatever happened, at `ArgoFeedRow.lineHeight`.
struct FeedDelegationEndRow: View {
    @Environment(\.argo) private var argo

    let end: FeedDelegationEnd

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(FeedDelegationEndCopy.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(verdict ?? argo.color.text.tertiary)
            FeedCallSubject(subject: end.subject, tint: verdict, isOpen: false)
            took
            spend
        }
        .lineLimit(1)
        .frame(height: ArgoFeedRow.lineHeight, alignment: .center)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(end.spoken)
    }

    /// The mark of the work coming BACK — `delegated` turned around, so the pair reads as one
    /// handover in the column the delegation opened. Drawn in the box even at its own width, so
    /// the verb stands on the vertical every other verb in the run does.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay { ArgoGlyph(ArgoSymbol.returned, .inline) }
            .foregroundStyle(quiet)
    }

    /// How long it ran, and nothing at all where the record reported no total. Monospaced digits at
    /// the quietest rung: it is there to be CHECKED rather than read, exactly as the rail's own
    /// meter sets it.
    @ViewBuilder private var took: some View {
        if let durationMs = end.durationMs {
            Text(TurnClockPhrase.figure(seconds: durationMs / 1000))
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(quiet)
        }
    }

    /// What the whole Subagent cost. `FeedSpend.agentWords` carries why it is the fresh half alone
    /// and why the figure is labelled — the same words the chip in the rail draws, so a reader
    /// holding one against the other finds one number.
    @ViewBuilder private var spend: some View {
        if let spend = end.spend {
            Text(FeedSpend.agentWords(spend))
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(quiet)
        }
    }

    /// The ink the WHOLE line takes, or `nil` for a delegation that came back fine. Read off
    /// `FeedInk` rather than the palette, so the row and the lane beside it cannot come to
    /// disagree about what a failure looks like.
    private var verdict: ArgoColor? {
        end.ink.state(in: argo.color)
    }

    /// Everything on the line that is not its words. One property because a failed line is red to
    /// its LAST character — asked three times, the answer is three places the failure can be
    /// forgotten.
    private var quiet: ArgoColor {
        verdict ?? argo.color.text.disabled
    }
}

// The pair, side by side: one that came back with both figures, and one that failed — so the words
// staying the same across the two is visible, and the colour is the only thing that moved.
#Preview("Delegation endings — returned and failed") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        FeedDelegationEndRow(end: FeedDelegationEnd(
            subject: .plain("Standards review"),
            ending: .succeeded,
            durationMs: 223_591,
            spend: Usage(
                inputTokens: 3600,
                outputTokens: 40000,
                cacheReadTokens: 100_000,
                cacheCreationTokens: 0,
            ),
        ))
        FeedDelegationEndRow(end: FeedDelegationEnd(
            subject: .plain("Spec review"),
            ending: .failed,
            durationMs: nil,
            spend: nil,
        ))
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: ArgoFeedRow.column)
    .argoDeckSurface()
    .argoAppearance()
}
