import AppKit

/// Keeps the axis it can answer and hands the other back to whatever is behind it.
final class AxisKeepingScrollView: NSScrollView {
    override func scrollWheel(with event: NSEvent) {
        if abs(event.scrollingDeltaY) > abs(event.scrollingDeltaX) {
            nextResponder?.scrollWheel(with: event)
        } else {
            super.scrollWheel(with: event)
        }
    }

    /// The run is sized by hand because the document is an `NSHostingView` with no constraints
    /// into this view: at least the clip's width so a short run still owns its whole line, and
    /// always the clip's height so nothing scrolls in the axis being handed away.
    override func layout() {
        super.layout()
        guard let document = documentView else { return }
        let fitting = document.fittingSize
        document.setFrameSize(NSSize(
            width: max(fitting.width, contentSize.width),
            height: contentSize.height,
        ))
    }
}
