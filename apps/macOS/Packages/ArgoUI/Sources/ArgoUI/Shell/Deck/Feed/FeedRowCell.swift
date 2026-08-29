import AppKit
import SwiftUI

/// One recycled cell of the reading: a hosting view pinned to its edges, whose fitting height is
/// the row's height. The rootView is replaced on reuse rather than the cell rebuilt — recycling
/// is the point of the table.
///
/// One pool per `FeedRow.Content.Shape`, so a recycled cell is handed the tree it already holds and
/// SwiftUI diffs rather than rebuilds. A single pool recycles a call's cell onto a mark, which is a
/// different tree and costs the full build — 1.365 ms a row against 0.494 ms, and it is paid for
/// every row a scroll exposes.
final class FeedRowCell: NSTableCellView {
    static func reuse(_ shape: FeedRow.Content.Shape) -> NSUserInterfaceItemIdentifier {
        NSUserInterfaceItemIdentifier("FeedRowCell.\(shape.rawValue)")
    }

    let host: NSHostingView<AnyView>

    init(shape: FeedRow.Content.Shape) {
        self.host = NSHostingView(rootView: AnyView(EmptyView()))
        // No sizing constraints at all: the table dictates the frame — width from the column,
        // height from `heightOfRow` — so every constraint the hosting view would build is a
        // SwiftUI layout pass spent probing a size nothing reads.
        host.sizingOptions = []
        super.init(frame: .zero)
        identifier = Self.reuse(shape)
        host.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host)
        NSLayoutConstraint.activate([
            host.leadingAnchor.constraint(equalTo: leadingAnchor),
            host.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.topAnchor.constraint(equalTo: topAnchor),
            host.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("FeedRowCell is code-only")
    }
}
