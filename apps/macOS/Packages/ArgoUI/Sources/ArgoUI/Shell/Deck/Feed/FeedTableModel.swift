import SwiftUI

/// Everything the AppKit half of the feed needs from the SwiftUI half, taken as one value.
///
/// A value and not a set of coordinator properties, because it changes as one thing: every
/// `updateNSView` hands the coordinator a fresh copy, and a field read from a stale one is the
/// class of bug this table exists to end. The environment rides along because an `NSHostingView`
/// inherits nothing from the hierarchy above it — a cell drawn without it would render the theme's
/// defaults rather than the cockpit's.
@MainActor struct FeedTableModel {
    var rows: [FeedRow]
    var selection: FeedRowSelection
    /// Which row the reading opens held at — see `FeedView.held`.
    var held: FeedRow.ID?
    /// Whether the reading is following the Session. Owned by `FeedView`, obeyed here.
    var isFollowing: Bool
    /// Whether a deck seam is being dragged right now. Mid-drag the table re-measures visible
    /// rows only; the edge off this flag is when the deferred full pass runs.
    var isResizing: Bool
    /// Whether the composer floats over this reading — it grows the gutter under the last row,
    /// so the newest line genuinely ends clear of the vessel.
    var isUnderComposer: Bool
    /// The row the user's own words just landed on, while the accent wash stands over it — see
    /// `FeedView.washed`.
    var washed: FeedRow.ID?
    /// Which prompts the reader has unfolded — the feed's copy, written through.
    var unfolded: Binding<Set<FeedRow.ID>>
    /// Reports a scroll the READER made, as the following answer it produced. Never called for a
    /// scroll this table made itself — AppKit's live-scroll notifications only fire for the hand.
    var onReaderScroll: (Bool) -> Void
    /// The SwiftUI environment at the representable, replayed into every cell.
    var environment: EnvironmentValues

    /// One row of the reading, dressed as the column drew it: its step from the row above, the
    /// feed's gutters, and the measure — per cell now, which lands the same place it did on the
    /// stack, because every cell is the column's full width.
    func content(at index: Int) -> AnyView {
        let row = rows[index]
        return AnyView(
            FeedRowView(row: row, isExpanded: unfolding(row.id), selection: selection)
                .padding(.top, step(before: index))
                .background {
                    if washed == row.id {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .fill(environment.argo.color.state
                                .muted(environment.argo.color.interaction.accent))
                    }
                }
                .argoAnimation(.bloom, value: washed == row.id)
                .padding(.horizontal, ArgoFeedRow.inset)
                .argoFeedMeasure()
                .environment(\.self, environment),
        )
    }

    func unfolding(_ id: FeedRow.ID) -> Binding<Bool> {
        let unfolded = unfolded
        return Binding(
            get: { unfolded.wrappedValue.contains(id) },
            set: { isOn in
                if isOn {
                    unfolded.wrappedValue.insert(id)
                } else {
                    unfolded.wrappedValue.remove(id)
                }
            },
        )
    }

    /// A run of calls is one piece of work and sits closer together than two things the agent
    /// said. A fact about a PAIR of rows, so it lives on the reading and not on a row — a row that
    /// padded itself would double the gap wherever two of them met.
    private func step(before position: Int) -> CGFloat {
        guard position > 0 else { return 0 }
        return rows[position - 1].isCall && rows[position].isCall
            ? ArgoFeedRow.callStep
            : ArgoFeedRow.gap
    }
}
