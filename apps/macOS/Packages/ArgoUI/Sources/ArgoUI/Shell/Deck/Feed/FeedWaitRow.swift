import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// A wait that ENDED, dropped into the reading as one settled line.
///
/// It is a CALL row's shape, because that is what the reading already spends on "a thing that
/// happened": the mark column drawn empty so every verb in a run starts on one vertical, the words
/// a step below the plinth's live ink, and what it took in machine type at the quietest rung.
///
/// A failure is drawn exactly as `FeedCallLine` draws a call that failed — the whole line in
/// `state.failure`, with the reason appended — **so the two are told apart by nothing but their
/// words**. A reader scanning a column of red should not have to learn a second grammar for a wait.
///
/// One line, whatever happened, at `ArgoFeedRow.lineHeight`.
struct FeedWaitRow: View {
    @Environment(\.argo) private var argo

    let settled: SessionWaitSettled

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(sentence)
                .argoText(ArgoTypography.body)
                .foregroundStyle(verdict ?? argo.color.text.tertiary)
            took
            reason
        }
        .lineLimit(1)
        .frame(height: ArgoFeedRow.lineHeight, alignment: .center)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
    }

    /// The wait's own mark, drawn in the column even where there is none: a wait with no mark keeps
    /// the box, so the words below a run of calls stand on the calls' own vertical.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay {
                if let symbol = words.symbol {
                    ArgoGlyph(symbol, .inline)
                }
            }
            .foregroundStyle(quiet)
    }

    /// What the wait took. Monospaced digits, at the quietest rung on the row: it is there to be
    /// CHECKED rather than read, exactly as the plinth's live elapsed reading is.
    private var took: some View {
        Text(TurnClockPhrase.figure(seconds: settled.tookSeconds))
            .argoText(ArgoTypography.machineCaption)
            .monospacedDigit()
            .foregroundStyle(quiet)
    }

    /// Why it failed, and nothing at all where it did not. In the same ink as the rest of the line,
    /// because a failed line is red to its last character.
    ///
    /// Set off with a dash rather than a second gap: what it took and why it failed are two machine
    /// figures in one run of type, and side by side with a space between them the duration reads as
    /// part of the sentence that follows it.
    @ViewBuilder private var reason: some View {
        if let failure = settled.failure {
            Text("— \(failure)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(quiet)
        }
    }

    private var words: FeedWaitWords {
        FeedWaitWords(settled.wait)
    }

    /// What the line says: the past tense where the wait ended the way it was meant to, and what
    /// did NOT happen where it failed. The reason follows in machine type rather than inside this.
    private var sentence: String {
        settled.failure == nil ? words.settled : words.failed
    }

    /// The ink the WHOLE line takes, or `nil` for a wait that ended the way it was meant to. Read
    /// off `FeedInk` rather than reaching for the palette, so the row and the lane beside it cannot
    /// come to disagree about what a failure looks like.
    private var verdict: ArgoColor? {
        settled.failure == nil ? nil : FeedInk.failure.state(in: argo.color)
    }

    /// Everything on the line that is not its words: the mark, what it took, and why it failed. One
    /// property because a failed line is red to its LAST character — asked three times, the answer
    /// is three places the failure can be forgotten.
    private var quiet: ArgoColor {
        verdict ?? argo.color.text.disabled
    }

    /// What the line says, as one sentence: the verb, what it took, and the reason where there is
    /// one. The failure is carried in the words for a reader who cannot see the red.
    private var spoken: String {
        let said = settled.failure.map { "\(sentence) — \($0)" } ?? sentence
        return "\(said), \(TurnClockPhrase.spoken(seconds: settled.tookSeconds))"
    }
}

// The pair, side by side: a start that landed and one that never did, so the second grammar the
// design refuses is visible by its absence.
#Preview("Wait rows — settled and failed") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        FeedWaitRow(settled: SessionWaitSettled(wait: .starting, tookMs: 1340))
        FeedWaitRow(
            settled: SessionWaitSettled(
                wait: .starting,
                tookMs: 820,
                failure: "the process exited with code 1",
            ),
        )
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: ArgoFeedRow.column)
    .argoDeckSurface()
    .argoAppearance()
}
