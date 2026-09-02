import AppKit
import SwiftUI

/// The way text leaves the feed (#734): a right-click on any row offers the row's own words and the
/// whole Turn's, as the markdown the agent wrote.
///
/// Selection cannot cross a row here — each is its own `NSTableView` cell — so this is what a
/// reader
/// takes text away with. The Turn's extent is walked outwards from the row rather than swept over
/// the whole reading (`TurnExtents.span`), because this sits on every cell of it.
struct FeedRowCopyMenu: ViewModifier {
    package let rows: [FeedRow]
    let index: Int

    func body(content: Content) -> some View {
        content.contextMenu { items }
    }

    @ViewBuilder private var items: some View {
        if let label = row?.kind.copyLabel, let text = row?.kind.words {
            Button(label) { ArgoPasteboard.put(text) }
        }
        if let turn = FeedCopy.turn(of: rows, holding: index) {
            Button("Copy Turn") { ArgoPasteboard.put(turn) }
        }
    }

    private var row: FeedRow? {
        rows.indices.contains(index) ? rows[index] : nil
    }
}

extension View {
    /// Offers this row's words and its Turn's to the pasteboard. Applied where the whole reading is
    /// in hand, because the Turn's extent is a fact about the feed rather than about the row.
    func argoFeedCopyMenu(rows: [FeedRow], index: Int) -> some View {
        modifier(FeedRowCopyMenu(rows: rows, index: index))
    }
}
