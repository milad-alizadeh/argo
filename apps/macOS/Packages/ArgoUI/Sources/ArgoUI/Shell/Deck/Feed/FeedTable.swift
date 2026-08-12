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
struct FeedTable: NSViewRepresentable {
    let rows: [FeedRow]
    let selection: FeedRowSelection
    let held: FeedRow.ID?
    let isFollowing: Bool
    let isResizing: Bool
    let isUnderComposer: Bool
    let washed: FeedRow.ID?
    @Binding var unfolded: Set<FeedRow.ID>
    let onReaderScroll: (Bool) -> Void
    let handle: FeedTableHandle

    func makeCoordinator() -> FeedTableCoordinator {
        FeedTableCoordinator()
    }

    func makeNSView(context: Context) -> NSScrollView {
        let view = context.coordinator.makeScrollView()
        handle.coordinator = context.coordinator
        context.coordinator.apply(model(in: context))
        return view
    }

    func updateNSView(_: NSScrollView, context: Context) {
        handle.coordinator = context.coordinator
        context.coordinator.apply(model(in: context))
    }

    private func model(in context: Context) -> FeedTableModel {
        FeedTableModel(
            rows: rows,
            selection: selection,
            held: held,
            isFollowing: isFollowing,
            isResizing: isResizing,
            isUnderComposer: isUnderComposer,
            hasMinimap: context.environment.deckHasMinimap,
            washed: washed,
            unfolded: $unfolded,
            onReaderScroll: onReaderScroll,
            environment: context.environment,
        )
    }
}
