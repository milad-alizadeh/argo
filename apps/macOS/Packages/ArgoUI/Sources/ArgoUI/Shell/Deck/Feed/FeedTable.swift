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
    /// Which reading this is, so the coordinator can tell another Session's rows from this one's
    /// next batch — see `FeedReading`.
    let reading: FeedReading
    let rows: [FeedRow]
    let selection: FeedRowSelection
    let held: FeedRow.ID?
    let isResizing: Bool
    let isUnderComposer: Bool
    let washed: FeedRow.ID?
    @Binding var unfolded: Set<FeedRow.ID>
    let handle: FeedTableHandle

    func makeCoordinator() -> FeedTableCoordinator {
        FeedTableCoordinator()
    }

    func makeNSView(context: Context) -> NSScrollView {
        let view = context.coordinator.makeScrollView()
        bind(context.coordinator, through: context.environment)
        context.coordinator.apply(model(in: context))
        return view
    }

    func updateNSView(_: NSScrollView, context: Context) {
        bind(context.coordinator, through: context.environment)
        context.coordinator.apply(model(in: context))
    }

    /// The two halves of one authority: the handle reaches the table through the coordinator, and
    /// the coordinator reaches the policy through the handle.
    ///
    /// The measured heights come the other way. They are the shell's where the shell holds them,
    /// because this representable is destroyed on every room switch and they must not be (#858).
    private func bind(_ coordinator: FeedTableCoordinator, through values: EnvironmentValues) {
        handle.coordinator = coordinator
        coordinator.handle = handle
        // Per READING and not per shell: one store shared across Sessions is overwritten by
        // whichever was looked at last, so coming back re-measures. See `FeedGeometries`.
        coordinator.keep(values.argoFeedGeometries?.geometry(for: reading))
    }

    private func model(in context: Context) -> FeedTableModel {
        FeedTableModel(
            reading: reading,
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
