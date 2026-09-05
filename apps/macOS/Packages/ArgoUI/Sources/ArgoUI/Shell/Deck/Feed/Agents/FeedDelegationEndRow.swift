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
            figures
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

    /// The two figures the record can report, in the order the rail's own meter sets them: how long
    /// it ran, and what it cost. Each absent where the record reported none, which is every
    /// backgrounded Agent (#908) — and a row that reports neither draws its words alone.
    ///
    /// `FeedSpend.agentWords` carries why the spend is the fresh half and why it is labelled, and
    /// the duration is the figure the chip in the rail draws, so a reader holding one against the
    /// other finds one number.
    @ViewBuilder private var figures: some View {
        figure(end.durationMs.map { TurnClockPhrase.figure(seconds: $0 / 1000) })
        figure(end.spend.map(FeedSpend.agentWords))
    }

    /// One machine figure at the quietest rung on the row: it is there to be CHECKED rather than
    /// read. Nothing at all where the record holds no such figure. One builder over both, so the
    /// type they are set in cannot drift apart between them.
    @ViewBuilder private func figure(_ words: String?) -> some View {
        if let words {
            Text(words)
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

// The three shapes the row takes, one under another: both figures, neither, and the failure. The
// words do not move across them — the colour and the figures are all that do, which is the claim.
#Preview("Delegation endings — returned, unreported, and failed") {
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
        // A backgrounded Agent, which reports neither figure at either end (#908) — the state that
        // proves no `0` is drawn in place of what the record does not hold.
        FeedDelegationEndRow(end: FeedDelegationEnd(
            subject: .plain("Sweep the stop reasons"),
            ending: .succeeded,
            durationMs: nil,
            spend: nil,
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
