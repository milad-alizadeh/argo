import SwiftUI

/// Everything the AppKit half of the feed needs from the SwiftUI half, taken as one value: every
/// `updateNSView` hands the coordinator a fresh copy, so no field can be read from a stale one. The
/// environment rides along because an `NSHostingView` inherits nothing from the hierarchy above it
/// — a cell drawn without it renders the theme's defaults rather than the cockpit's.
@MainActor struct FeedTableModel {
    var rows: [FeedRow]
    var selection: FeedRowSelection
    /// Which row the reading opens held at — see `FeedView.held`.
    var held: FeedRow.ID?
    /// Whether a deck seam is being dragged right now. Mid-drag the table re-measures visible rows
    /// only; the edge off this flag is when the deferred full pass runs.
    var isResizing: Bool
    /// Whether the composer floats over this reading — it grows the gutter under the last row, so
    /// the newest line genuinely ends clear of the vessel.
    var isUnderComposer: Bool
    /// The row the user's own words just landed on, while the accent wash stands over it — see
    /// `FeedView.washed`.
    var washed: FeedRow.ID?
    /// Which prompts the reader has unfolded — the feed's copy, written through.
    var unfolded: Binding<Set<FeedRow.ID>>
    /// The SwiftUI environment at the representable, replayed into every cell.
    var environment: EnvironmentValues

    /// One row of the reading, dressed as the column drew it: its step from the row above, the
    /// feed's gutters, and the measure — per cell, since every cell is the column's full width.
    ///
    /// The working thread alone takes no gutter and no measure: its ion crosses the whole zone and
    /// exits at the minimap's seam, not at a hard cut mid-panel.
    func content(at index: Int) -> AnyView {
        let row = rows[index]
        let dressed = FeedRowView(row: row, isExpanded: unfolding(row.id), selection: selection)
            .padding(.top, FeedRow.step(to: row, from: index > 0 ? rows[index - 1] : nil))
            .background {
                if washed == row.id {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(environment.argo.color.state
                            .muted(environment.argo.color.interaction.accent))
                }
            }
            .argoAnimation(.bloom, value: washed == row.id)
        guard !row.isWorkingThread else {
            return AnyView(dressed.environment(\.self, environment))
        }
        return AnyView(
            dressed
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
}

extension FeedRow {
    /// The step above a row, which the row's own cell carries as top padding.
    ///
    /// A run of calls is one piece of work and sits closer together than two things the agent said.
    /// A fact about a PAIR of rows, which is why it is passed the row above rather than asked of
    /// one row — a row that padded itself would double the gap wherever two of them met.
    ///
    /// Named here because it is INSIDE the height the table measures, so the overview lane has to
    /// subtract it: every mark of a row starts this far down its cell, and a lane that drew from
    /// the cell's top put every line of the reading a step above the words it stands for.
    static func step(to row: FeedRow, from previous: FeedRow?) -> CGFloat {
        guard let previous else { return 0 }
        return previous.isCall && row.isCall ? ArgoFeedRow.callStep : ArgoFeedRow.gap
    }
}
