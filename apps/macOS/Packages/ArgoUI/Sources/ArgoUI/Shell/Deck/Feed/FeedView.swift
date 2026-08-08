import SwiftUI

/// The Session's reading, filling the deck's feed zone.
///
/// It takes rows and nothing else — no Session, no selection, no Hub — so the same view draws a
/// live transcript, a specimen and a preview. What is on screen is what the projection produced,
/// in the order it produced it.
struct FeedView: View {
    let rows: [FeedRow]
    /// Which call's evidence is open. Owned by the deck, not here: opening one resizes the column
    /// this view is drawn in, which is a fact about the deck rather than about the feed.
    @Binding var open: FeedRow.ID?

    /// Which prompts the reader has unfolded. Held here rather than in the row: the stack is lazy,
    /// so a row's own state dies the moment it scrolls out of view.
    @State private var unfolded: Set<FeedRow.ID> = []

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { position, row in
                    FeedRowView(row: row, isExpanded: unfolding(row.id), open: $open)
                        .padding(.top, step(before: position))
                }
            }
            .padding(.horizontal, ArgoFeedRow.inset)
            .padding(.vertical, ArgoSpacing.section)
            // The column, held to a measure and centred in whatever the seams leave it. A feed is
            // read start to finish, and a line that runs the width of a wide display loses the
            // reader's eye on the way back to the next one — so the deck gets wider and the reading
            // does not. Centred rather than pinned left, because a bounded column against the
            // leading edge reads as a column that failed to fill the space beside it.
            .argoFeedMeasure()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if rows.isEmpty {
                FeedSilence()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Feed")
    }

    /// A run of calls is one piece of work and sits closer together than two things the agent
    /// said. The step lives here rather than on the row because it is a fact about a PAIR of rows,
    /// and a row that padded itself would double the gap wherever two of them met.
    private func step(before position: Int) -> CGFloat {
        guard position > 0 else { return 0 }
        return rows[position - 1].isCall && rows[position].isCall
            ? ArgoFeedRow.callStep
            : ArgoFeedRow.gap
    }

    private func unfolding(_ id: FeedRow.ID) -> Binding<Bool> {
        Binding(
            get: { unfolded.contains(id) },
            set: { isOn in
                if isOn {
                    unfolded.insert(id)
                } else {
                    unfolded.remove(id)
                }
            },
        )
    }
}

/// One row, drawn as what it is.
private struct FeedRowView: View {
    let row: FeedRow
    @Binding var isExpanded: Bool
    @Binding var open: FeedRow.ID?

    var body: some View {
        switch row.content {
        case let .prompt(text): FeedPrompt(text: text, isExpanded: $isExpanded)
        case let .message(markdown): FeedProse(text: markdown, voice: .message)
        case let .thought(markdown): FeedProse(text: markdown, voice: .thought)
        case let .call(call):
            FeedCallLine(call: call, isOpen: open == row.id, open: toggle)
        case let .survey(survey):
            FeedSurveyLine(survey: survey, isOpen: open == row.id, open: toggle)
        }
    }

    /// A second click on the open row closes it. The row is the control, so it is also the way back
    /// out — a panel whose only exit is its own ✕ makes the reader aim at the far side of the deck
    /// to undo a click they made on this one.
    private func toggle() {
        open = open == row.id ? nil : row.id
    }
}

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// A claim about this SURFACE and not about the Session: an agent can be busy in kinds this feed
/// does not draw yet, and "nothing said" would be a reading of the record rather than of the feed.
private struct FeedSilence: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing to read yet")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
    }
}

#Preview("Feed — a turn read from a transcript") {
    FeedView(rows: FeedProjection.previewRows, open: .constant(nil))
        .frame(width: 820, height: 560)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed — a deck wide enough to break the measure") {
    FeedView(rows: FeedProjection.previewRows, open: .constant(nil))
        .frame(width: 1440, height: 560)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed — a Session that has said nothing") {
    FeedView(rows: [], open: .constant(nil))
        .frame(width: 820, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
