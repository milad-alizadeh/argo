import AppKit
import SwiftUI

/// The gallery's sideways scroller — AppKit's, so a wheel gesture can be split by axis.
///
/// A SwiftUI `ScrollView(.horizontal)` hosted inside the feed's table takes every wheel event and
/// has no vertical axis to spend one on, so the reading goes dead wherever a gallery sits under
/// the cursor. An `NSScrollView` can read a gesture's dominant axis and keep only the one it can
/// answer: sideways stays here, up-and-down goes back to the feed behind it.
struct FeedGalleryScroller<Content: View>: NSViewRepresentable {
    @ViewBuilder let content: Content

    func makeNSView(context: Context) -> AxisKeepingScrollView {
        let scroller = AxisKeepingScrollView()
        scroller.drawsBackground = false
        scroller.hasHorizontalScroller = true
        scroller.autohidesScrollers = true
        scroller.verticalScrollElasticity = .none
        // Bounce only when there is somewhere to go: a run that fits must not rubber-band — a row
        // bouncing on a drag advertises a direction it has nothing in.
        scroller.horizontalScrollElasticity = .automatic
        scroller.documentView = NSHostingView(rootView: dressed(in: context))
        return scroller
    }

    func updateNSView(_ scroller: AxisKeepingScrollView, context: Context) {
        guard let host = scroller.documentView as? NSHostingView<AnyView> else { return }
        host.rootView = dressed(in: context)
        host.setFrameSize(host.fittingSize)
    }

    func sizeThatFits(
        _ proposal: ProposedViewSize, nsView scroller: AxisKeepingScrollView, context _: Context,
    ) -> CGSize? {
        guard let document = scroller.documentView else { return nil }
        let fitting = document.fittingSize
        return CGSize(width: proposal.width ?? fitting.width, height: fitting.height)
    }

    /// The run with the cockpit's environment replayed onto it — an `NSHostingView` inherits
    /// nothing from the hierarchy above it, and a shot drawn without it renders the theme's
    /// defaults rather than the cockpit's.
    private func dressed(in context: Context) -> AnyView {
        AnyView(content.environment(\.self, context.environment))
    }
}

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
