import AppKit
import ArgoAtoms
import ArgoDesign
import SwiftUI
import Testing

/// That an `.inset` list is a table the probe reaches, and that it honours the property (#1165).
///
/// `ListSelectionFillTests` holds the walk itself against a hand-built view tree, which proves the
/// walk and nothing about SwiftUI. What this suite asks is the question that made #1165 risky: the
/// switch was measured on `.listStyle(.sidebar)` and the backlog draws `.inset`, and whether that
/// style is `NSTableView`-backed at all on this OS is a fact about SwiftUI, not about Argo. A still
/// render cannot answer it — the platform's fill is drawn between mouse-down and mouse-up, and a
/// specimen has no pressed state — so the list is HOSTED here and the tree is read.
@Suite("Inset list selection fill")
@MainActor
struct InsetListSelectionFillTests {
    /// The one claim: after a hosted `.inset` list has laid out, the table under its rows is not
    /// drawing its own selection. A failure is either style — `.inset` hosting something that is
    /// not an `NSTableView`, or one that ignores the property — and the message says which.
    @Test
    func `an inset list's own table stops drawing its selection`() throws {
        let host = NSHostingView(rootView: ProbedList())
        host.frame = NSRect(x: 0, y: 0, width: 320, height: 240)
        let window = NSWindow(
            contentRect: host.frame,
            styleMask: [.titled], backing: .buffered, defer: false,
        )
        window.contentView = host
        // In a window and laid out, which is what the probe waits for: `viewDidMoveToWindow` is
        // where it walks, and nothing above a row is a table until the list has built its cells.
        window.layoutIfNeeded()
        host.layoutSubtreeIfNeeded()

        let table = try #require(
            Self.table(under: host),
            """
            A hosted `.listStyle(.inset)` list built no `NSTableView`, so the probe has nothing to \
            switch off and the backlog's rows are drawn by something this repo has never measured.
            """,
        )
        #expect(
            table.selectionHighlightStyle == .none,
            """
            The `.inset` list's table kept `selectionHighlightStyle == .regular`, so the platform \
            still paints the pressed row under the ground — the divergence #1137 closed in the \
            rails, reopened in the backlog.
            """,
        )
    }

    /// The first `NSTableView` anywhere under `view`, breadth-first: how deeply SwiftUI nests its
    /// scroll view is its own business and not something to assert on.
    private static func table(under view: NSView) -> NSTableView? {
        var queue = view.subviews
        while !queue.isEmpty {
            let next = queue.removeFirst()
            if let table = next as? NSTableView {
                return table
            }
            queue.append(contentsOf: next.subviews)
        }
        return nil
    }

    /// The backlog's list, reduced to what the claim is about: `.inset`, and a row carrying the
    /// ground with its probe.
    private struct ProbedList: View {
        var body: some View {
            List {
                ForEach(0 ..< 3) { row in
                    Text(String(row))
                        .argoSelectedRowGround(isSelected: row == 0)
                }
            }
            .listStyle(.inset)
            .argoAppearance()
        }
    }
}
