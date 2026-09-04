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
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Button(action: opening.expand) {
                sentence
            }
            // No open ground of its own: while the list is out the BOX is what says the row is
            // open, and a second wash inside it reads as a header selected against its own names.
            .buttonStyle(FeedRowButtonStyle(isOpen: false))
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
        .background { box }
    }

    /// What holds the header and its names together while the row is open: ONE box, drawn exactly
    /// where the header's own ground would have been.
    ///
    /// Behind the stack rather than around it, and outset by the row style's own inset, so nothing
    /// inside moves a point when the list comes out — a box that laid its children out would shift
    /// the header's words off the vertical every other row in the feed sets them on.
    @ViewBuilder private var box: some View {
        if opening.isExpanded {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(argo.color.surface.raised)
                .overlay {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.hairline)
                }
                .padding(.horizontal, -FeedRowButtonStyle.groundInsetX)
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
            Text("(\(fold.failures, format: .machine) Failed)")
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
    ///
    /// The TURN is the whole of what it says, and it keeps one ink through it — an accent here
    /// would read as a panel being up, which is a name's answer and never the header's. Standing
    /// off the words by more than the sentence's own gap, because a mark that turns sits nearer
    /// what is beside it in one of its two directions.
    @ViewBuilder private var chevron: some View {
        if fold.disclosure == .available {
            ArgoDisclosure(opening.isExpanded ? .below : .beside)
                .foregroundStyle(argo.color.text.disabled)
                .padding(.leading, ArgoFeedRow.foldChevronGap)
        }
    }

    /// What the run actually did, listed under the count — but only while the reader has the list
    /// out.
    ///
    /// Stacked FLUSH, with a hairline over every name: each is a single line that ENDS, so what
    /// parts one from the next is the rule rather than air, and the rule over the first is what
    /// parts the whole list from the header it belongs to. `lineSpacing` is stated flush for the
    /// same reason — it is inherited, and a list carrying the paragraph's leading stands as far
    /// apart as the sentences of a message (#1228).
    private var listed: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(fold.steps) { step in
                FeedFoldStepName(
                    step: step,
                    isCurrent: isCurrent(step),
                    isPointedAt: step.id == opening.pointsAt,
                    look: opening.look,
                )
                .overlay(alignment: .top) {
                    ArgoRule(ink: argo.color.edge.hairline)
                        .padding(.horizontal, -FeedRowButtonStyle.groundInsetX)
                }
            }
        }
        .lineSpacing(ArgoSpacing.flush)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What this run did")
    }

    /// Whether the name this step is standing for is the one the panel is open on — not by an
    /// exact match on `goesTo`, but by which call OWNS whatever step is at the top of the panel:
    /// a scroll inside the panel can leave it open on a call's third result, and every step of
    /// that one call still lights this one name (`FeedFold.call(ofStep:of:)`, #1355).
    private func isCurrent(_ step: FeedFoldStep) -> Bool {
        guard step.goesTo != nil, let current = opening.current else { return false }
        return FeedFold.call(ofStep: current, of: fold.calls) == step.id
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(fold: any FeedFolded, opening: FeedFoldOpening) {
        self.fold = fold
        self.opening = opening
    }
}
