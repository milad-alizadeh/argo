import AppKit
import SwiftUI

/// A double-click on a `List` row that does not cost the row its single click.
///
/// SwiftUI has no gesture that can do this. `TapGesture(count: 2)` hit-tests ahead of the row it
/// sits on and swallows the click that should have selected it — `simultaneousGesture` included,
/// which reads as though it composes with the List and does not, because the List's selection is
/// AppKit's and not another SwiftUI gesture to be simultaneous with. AppKit's own recognizer is
/// the one thing that can say "two clicks, and everything else passes":
/// `delaysPrimaryMouseButtonEvents = false` is the whole of the fix.
extension View {
    /// Double-click anywhere on the enclosing row. Attached to the row rather than to one label,
    /// because the recognizer lives on AppKit's row view and a row is the grain AppKit addresses.
    func onRowDoubleClick(perform action: @escaping () -> Void) -> some View {
        background(RowDoubleClick(action: action))
    }
}

private struct RowDoubleClick: NSViewRepresentable {
    let action: () -> Void

    func makeNSView(context _: Context) -> NSView {
        let view = RowDoubleClickView()
        view.action = action
        return view
    }

    func updateNSView(_ nsView: NSView, context _: Context) {
        (nsView as? RowDoubleClickView)?.action = action
    }
}

/// Invisible to hit-testing, so the view itself never stands between the pointer and the row: it
/// is here only to find the row and hang a recognizer on it.
private final class RowDoubleClickView: NSView {
    var action: () -> Void = {}

    private var recognizer: NSClickGestureRecognizer?

    override func hitTest(_: NSPoint) -> NSView? {
        nil
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        guard window != nil else { return detach() }
        attach()
    }

    /// The row view when there is one — a preview or a specimen draws these rows outside a `List`,
    /// and the nearest ancestor is the honest answer there.
    private var host: NSView? {
        sequence(first: self as NSView, next: \.superview)
            .first { $0 is NSTableRowView } ?? superview
    }

    private func attach() {
        guard recognizer == nil, let host else { return }
        let click = NSClickGestureRecognizer(target: self, action: #selector(fire))
        click.numberOfClicksRequired = 2
        click.delaysPrimaryMouseButtonEvents = false
        host.addGestureRecognizer(click)
        recognizer = click
    }

    /// AppKit reuses row views down a scrolling list, so a recognizer left on one would fire for
    /// whichever Session that row is drawing next.
    private func detach() {
        guard let recognizer else { return }
        recognizer.view?.removeGestureRecognizer(recognizer)
        self.recognizer = nil
    }

    @objc private func fire() {
        action()
    }
}
