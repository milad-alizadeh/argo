import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A fold of a run of calls, drawn as one quiet line: a mark, the counts in words, whatever the
/// stretch has to add to them, and the chevron.
///
/// The same anatomy as a call line and quieter than one throughout. BOTH folds are drawn through
/// it — the survey's stretch of looking and the Turn's card of work — so the two rows cannot drift
/// apart at the same window width, and what separates them is what `FeedFolded` asks each fold for
/// rather than a second view.
package struct FeedFoldLine: View {
    @Environment(\.argo) private var argo

    let fold: any FeedFolded
    /// How the row stands open, and where a name in its list sends the panel — see
    /// `FeedFoldOpening`.
    let opening: FeedFoldOpening

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
            Button(action: opening.expand) {
                sentence
            }
            .buttonStyle(FeedRowButtonStyle(isOpen: opening.isExpanded))
            .disabled(fold.disclosure == .none)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(fold.spoken)
            .accessibilityHint(
                fold.disclosure == .available ? "Lists what these calls were" : "",
            )
            if opening.isExpanded {
                listed
            }
        }
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(fold.label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(
                    opening.isExpanded ? argo.color.text.secondary : argo.color.text.tertiary,
                )
            failed
            if let churn = fold.churn {
                FeedChurnMarks(churn: churn)
            }
            chevron
        }
        .lineLimit(1)
    }

    /// How much of the stretch failed, said in the header rather than left for the reader to find
    /// by opening it — a card that folded a failure away would report the work went fine.
    ///
    /// Bracketed, because it is an aside on the count beside it rather than a second count: the
    /// line reads `Ran 2 Commands (1 Failed)`.
    @ViewBuilder private var failed: some View {
        if fold.failures > 0 {
            Text("(\(fold.failures) Failed)")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.state.failure)
        }
    }

    /// One mark for the whole run and not one per kind — the line already names the kinds.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay { ArgoGlyph(fold.symbol, .inline) }
            .foregroundStyle(argo.color.text.disabled)
    }

    /// Turned down while the list is out: the row is an accordion, and the mark says which way it
    /// opens rather than that a panel is up somewhere.
    @ViewBuilder private var chevron: some View {
        if fold.disclosure == .available {
            ArgoDisclosure(opening.isExpanded ? .below : .beside)
                .foregroundStyle(
                    opening.isExpanded ? argo.color.interaction.accent : argo.color.text.disabled,
                )
        }
    }

    /// What the run actually did, listed under the count — but only while the reader has the list
    /// out.
    private var listed: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            ForEach(fold.steps) { step in
                FeedFoldStepName(
                    step: step,
                    isCurrent: step.goesTo == opening.current,
                    look: opening.look,
                )
            }
        }
        .padding(.leading, ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What this run did")
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(fold: any FeedFolded, opening: FeedFoldOpening) {
        self.fold = fold
        self.opening = opening
    }
}

/// One name in a fold's list, and a way into the pane beside it.
///
/// A call the record answered with nothing is still listed — it happened — and is inert: there is
/// nothing behind it to go to. A call that FAILED keeps its name and takes the failure's ink, which
/// is the same answer a call row gives.
struct FeedFoldStepName: View {
    @Environment(\.argo) private var argo

    let step: FeedFoldStep
    let isCurrent: Bool
    let look: (Int) -> Void

    var body: some View {
        Button { step.goesTo.map(look) } label: {
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
                Text(step.caption)
                    .argoText(ArgoFeedRow.proseRung)
                    .lineLimit(1)
                    .truncationMode(.head)
                repeats
            }
            .foregroundStyle(ink)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .disabled(step.goesTo == nil)
        .accessibilityLabel(step.spoken)
        .accessibilityHint(step.goesTo == nil ? "" : "Shows what this call produced")
    }

    /// How many calls this one name stands for. Without it the list would not add up to the counts
    /// on the line above, which are in calls (`FeedFold.listed`).
    @ViewBuilder private var repeats: some View {
        if step.repeats > 1 {
            Text("×\(step.repeats)")
                .argoMono(ArgoFeedRow.proseRung)
                .monospacedDigit()
        }
    }

    private var ink: ArgoColor {
        if step.hasFailed {
            return argo.color.state.failure
        }
        return isCurrent ? argo.color.interaction.accentBright : argo.color.text.tertiary
    }
}
