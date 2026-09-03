import AppKit
import SwiftUI

/// Switches off the selection paint `.listStyle(.sidebar)`'s own `NSTableView` draws, so the only
/// selection in a sidebar is the ground Argo draws (`argoSelectedRowGround`).
///
/// The table's fill is the `AccentColor` asset at full strength while the list is first responder,
/// and it moves to the pressed row on mouse-DOWN. Argo's ground follows the `List`'s selection
/// binding, which moves on mouse-UP — the row selects itself from a tap gesture, because the title
/// carries a double-click (`SessionRow`). Covering the fill on the selected row therefore left the
/// pressed row wearing the platform's blue for the length of every held click, beside the old row
/// still on Argo's ground (#1137). Switched off at the table, there is nothing to cover.
///
/// Placed UNDER a row rather than beside the `List`: SwiftUI hosts a `.background` of the list
/// outside the scroll view, where no walk up the superviews reaches the table. A row's content sits
/// inside the table's own cell, so from there the walk is short and certain.
public enum SidebarSelectionFill {
    /// Walks up from `view` to the nearest `NSTableView` and turns its selection drawing off.
    /// Answers with the table it changed, or `nil` when there was none or it was already off, so a
    /// probe landing on a recycled cell writes nothing the second time.
    @MainActor @discardableResult
    public static func switchOff(above view: NSView) -> NSTableView? {
        var ancestor = view.superview
        while let candidate = ancestor {
            if let table = candidate as? NSTableView {
                guard table.selectionHighlightStyle != .none else { return nil }
                table.selectionHighlightStyle = .none
                return table
            }
            ancestor = candidate.superview
        }
        return nil
    }
}

/// A zero-size view that, once in a window, switches off the fill of the table above it.
struct SidebarSelectionFillProbe: NSViewRepresentable {
    func makeNSView(context _: Context) -> ProbeView {
        ProbeView()
    }

    func updateNSView(_: ProbeView, context _: Context) {}

    final class ProbeView: NSView {
        override var isOpaque: Bool {
            false
        }

        /// Never the view under the pointer: the row's own clicks and menu pass straight through.
        override func hitTest(_: NSPoint) -> NSView? {
            nil
        }

        /// The superview chain is complete only once the cell is in a window; before that the probe
        /// hangs off a hosting view with no table above it.
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard window != nil else { return }
            SidebarSelectionFill.switchOff(above: self)
        }
    }
}
