import AppKit
import SwiftUI

/// The feed's scroller — AppKit's, with the rows still SwiftUI.
///
/// Not a styling choice, and not the first thing tried. `ScrollView` + `LazyVStack` re-decides
/// the offset in SwiftUI against estimated heights, at frame rate, against a platform scroller
/// with its own open performance faults — and every fix for one symptom (the latch, the pin, the
/// settle passes) was another authority over the same offset. An `NSTableView` is the component
/// every flawless long feed on this platform actually stands on: it owns the offset, recycles
/// cells, measures rows lazily, and keeps the reading still through a re-wrap, none of which this
/// layer has to re-implement. The rows themselves stay SwiftUI, hosted per cell.
///
/// One table per reading, all of them inside one `FeedDeckStack` and exactly one shown (ADR-0030,
/// Rule 4). This representable never re-points a table at another reading: it asks the store which
/// deck this reading is, and hands a model to that deck alone.
struct FeedTable: NSViewRepresentable {
    /// Which reading this is — which DECK, since the store keys them on it. See `FeedReading`.
    package let reading: FeedReading
    package let rows: [FeedRow]
    let selection: FeedRowSelection
    let held: FeedRow.ID?
    let isResizing: Bool
    let isUnderComposer: Bool
    let washed: FeedRow.ID?
    @Binding var unfolded: Set<FeedRow.ID>
    /// This reading's deck, from the one view above every switch that would destroy it — see
    /// `KeptDecks`. Taken as a value: which deck is on screen is decided once a pass, above.
    let deck: KeptDeck

    func makeNSView(context _: Context) -> FeedDeckStack {
        FeedDeckStack()
    }

    func updateNSView(_ stack: FeedDeckStack, context: Context) {
        // Per READING and not per shell: one store shared across Sessions is overwritten by
        // whichever was looked at last, so coming back re-measures. See `FeedGeometries`. Taken
        // before the model, so nothing already measured is thrown away by the first apply.
        deck.coordinator.keep(context.environment.argoFeedGeometries?.geometry(for: reading))
        stack.show(deck)
        deck.coordinator.apply(model(in: context))
    }

    private func model(in context: Context) -> FeedTableModel {
        FeedTableModel(
            rows: rows,
            selection: selection,
            held: held,
            isResizing: isResizing,
            isUnderComposer: isUnderComposer,
            washed: washed,
            unfolded: $unfolded,
            environment: FeedCellEnvironment(context.environment),
        )
    }
}
