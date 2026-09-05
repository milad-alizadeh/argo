import AppKit
import SwiftUI

/// A block that scrolls ACROSS, and hands the wheel back up when the reader is scrolling down.
///
/// A `ScrollView(.horizontal)` alone is a trap inside a reading: the scroll view under the pointer
/// answers the wheel whether or not it has anywhere to go on that axis, so a code block or a
/// diagram in a long feed stops the page dead (#1385).
///
/// So the wheel is read before the scroll view sees it. A transparent sibling stands over the
/// block and takes the pointer for one kind of event only — a wheel travelling mostly down the
/// page — and hands that one to the scroller behind. Every other event, a wheel travelling mostly
/// across included, is refused at the hit test and reaches the block exactly as before: the words
/// stay selectable and the block still scrolls across.
public struct ArgoScrollAcross<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        // An overlay ON the scroll view, so the yield stands OVER it and outside it. Which side it
        // lands on is the whole mechanism: inside, `enclosingScrollView` would answer with this
        // block's own scroller and the event would come straight back. An overlay also costs the
        // layout nothing — it is measured at the size the scroll view already took.
        ScrollView(.horizontal) { content }
            .overlay { ArgoWheelYield() }
    }
}

/// The transparent sibling: it takes a wheel meant for the reading and nothing else at all.
private struct ArgoWheelYield: NSViewRepresentable {
    func makeNSView(context _: Context) -> ArgoWheelYieldView {
        ArgoWheelYieldView()
    }

    func updateNSView(_: ArgoWheelYieldView, context _: Context) {}
}

/// The view under `ArgoScrollAcross`. Public because the suite that proves the passthrough hosts
/// the real thing and reads this view out of the tree — the claim is about AppKit's dispatch, and
/// a stand-in would prove nothing about it.
public final class ArgoWheelYieldView: NSView {
    /// The event AppKit is dispatching right now, which is what decides whether this view is in the
    /// way. Settable because nothing outside AppKit's own dispatch can set `NSApp.currentEvent`,
    /// and a claim about which view is picked is worth nothing if the walk that picks it is the
    /// suite's rather than the platform's.
    public var eventInFlight: () -> NSEvent? = { NSApp.currentEvent }

    /// AppKit picks the view for a wheel with a hit test, so this is where a wheel is claimed or
    /// let go. A hit test asked for any other reason — a click into the words, a right-click, a
    /// pointer moving over them — answers `nil` and the block beneath keeps every one of them.
    override public func hitTest(_ point: NSPoint) -> NSView? {
        guard let event = eventInFlight(), Self.isForTheReadingBehind(event) else { return nil }
        return super.hitTest(point)
    }

    /// Whether a wheel belongs to the reading rather than to the block: a wheel travelling further
    /// down the page than across it. A trackpad swipe is never exactly one axis, so the question is
    /// which way it mostly went and not which deltas are non-zero.
    private static func isForTheReadingBehind(_ event: NSEvent) -> Bool {
        event.type == .scrollWheel && abs(event.scrollingDeltaY) > abs(event.scrollingDeltaX)
    }

    /// Handed on whole rather than re-issued, so the scroller behind reads the phase and the
    /// momentum off the reader's own event. With nothing behind — a block standing on its own —
    /// it goes back up the responder chain rather than being dropped.
    override public func scrollWheel(with event: NSEvent) {
        guard let behind = enclosingScrollView else {
            return super.scrollWheel(with: event)
        }
        behind.scrollWheel(with: event)
    }
}
