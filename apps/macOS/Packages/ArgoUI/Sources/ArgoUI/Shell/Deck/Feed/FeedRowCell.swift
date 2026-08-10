import AppKit
import SwiftUI

/// One recycled cell of the reading: a hosting view pinned to its edges, whose fitting height is
/// the row's height. The rootView is replaced on reuse rather than the cell rebuilt — recycling
/// is the point of the table.
final class FeedRowCell: NSTableCellView {
    static let reuse = NSUserInterfaceItemIdentifier("FeedRowCell")

    let host: NSHostingView<AnyView>

    init() {
        self.host = NSHostingView(rootView: AnyView(EmptyView()))
        // No sizing constraints at all: the table dictates the frame — width from the column,
        // height from `heightOfRow` — so every constraint the hosting view would build is a
        // SwiftUI layout pass spent probing a size nothing reads.
        host.sizingOptions = []
        super.init(frame: .zero)
        identifier = Self.reuse
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
