import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The way a settled question went, on the marker grid its offers were numbered in.
///
/// **The offer folds out; the question stays whole** (#1207). Once the record has settled an ask,
/// the two facts left are what was asked and which way it went — the options nobody took are the
/// shape of a decision already made, and they stop being lines. Truncating the QUESTION was the
/// other economy on offer and it is the wrong one: it saves 18pt where dropping the offer saves 96,
/// and it leaves the row stating a question nobody can finish reading.
///
/// A step back and not out: the words are `text.secondary`, because the question above them is what
/// a reader needs first.
struct FeedAskAnswer: View {
    /// What a settled question resolved to, and whether those words were ever offered.
    struct Words: Equatable {
        let words: String
        /// Whether they are an option the question put on its list. See `FeedAskAnswer.mark`.
        let isChosen: Bool
    }

    @Environment(\.argo) private var argo

    let answer: Words

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            ArgoGlyph(mark, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .feedMarkerColumn()
            Text(answer.words)
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(argo.color.text.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Answered, \(answer.words)")
    }

    /// A tick only where an option was named. `FeedAsk.chosen(in:)` is DERIVED and deliberately
    /// weak, so a free-form answer and one that agreed with nothing on the list name nothing — and
    /// a tick over words nobody offered claims a pick that never happened, which is the one thing
    /// degrade-down forbids.
    private var mark: String {
        answer.isChosen ? ArgoSymbol.chosen : ArgoSymbol.answered
    }
}

#Preview("A settled ask, folded — an option named, and prose that named none") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        FeedAskAnswer(answer: FeedAskAnswer.Words(words: "The ordinary ink", isChosen: true))
        FeedAskAnswer(answer: FeedAskAnswer.Words(
            words: "Neither — keep the ground and drop the stroke.", isChosen: false,
        ))
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 420)
    .argoDeckSurface()
    .argoAppearance()
}
