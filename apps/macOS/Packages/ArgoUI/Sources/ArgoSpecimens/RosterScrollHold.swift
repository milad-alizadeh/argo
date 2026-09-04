import AppKit
import SwiftUI

/// Holds the roster's own scroll view at a fixed offset, so "the list is scrolled" is a state a
/// still render can repeat (#1235). Nothing in the app scrolls the roster from code — a reader
/// rolls the wheel — and a wheel event is not something a screenshot has.
struct RosterScrollHold: NSViewRepresentable {
    /// How far down the roster is held, in points.
    let offset: CGFloat

    /// Whether the hold is still on. Turned off to hand the list back to itself, which is the only
    /// way to photograph what the roster does to its OWN offset when a row lands at the head.
    var isHolding = true

    func makeNSView(context: Context) -> NSView {
        let probe = NSView()
        context.coordinator.watch(probe)
        context.coordinator.heldOffset = heldOffset
        return probe
    }

    func updateNSView(_: NSView, context: Context) {
        context.coordinator.heldOffset = heldOffset
    }

    static func dismantleNSView(_: NSView, coordinator: Coordinator) {
        coordinator.release()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    private var heldOffset: CGFloat? {
        isHolding ? offset : nil
    }

    /// The beat that re-applies the offset, and the timer it runs on.
    ///
    /// Re-applied rather than set once: the list lays out again after the pass that mounted it,
    /// and an offset written before that lands on a document the next layout throws away. Writing
    /// an offset the clip view already has costs nothing, so a settled roster is left alone.
    @MainActor final class Coordinator {
        /// The offset held, or `nil` once the list is the harness's no longer.
        var heldOffset: CGFloat?

        /// Fast enough that the offset is in place before the render script's capture, which lands
        /// half a second after the window opens.
        private static let beatSeconds = 0.05

        private var beat: Timer?
        /// The view the window is reached through. Weak: SwiftUI owns it, and the beat outliving
        /// it must stop reaching rather than keep it up.
        private weak var probe: NSView?

        func watch(_ probe: NSView) {
            self.probe = probe
            // `.common`, so the offset keeps being re-applied while the window is being resized or
            // tracked — the modes a `.default` timer is starved in.
            let beat = Timer(timeInterval: Self.beatSeconds, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated { self?.apply() }
            }
            RunLoop.main.add(beat, forMode: .common)
            self.beat = beat
        }

        func release() {
            beat?.invalidate()
            beat = nil
        }

        private func apply() {
            guard let offset = heldOffset else { return }
            RosterScrollHold.roster(in: probe?.window)?.holdRoster(at: offset)
        }
    }

    /// The roster's scroller: the LEFTMOST table scroller in the window. The cockpit's other table
    /// is the feed's, which is in the deck — to the right of the sidebar at every width the shell
    /// opens at, since the sidebar is the leading column of the split.
    private static func roster(in window: NSWindow?) -> NSScrollView? {
        guard let root = window?.contentView else { return nil }
        return tableScrollers(under: root)
            .min { left, right in
                left.convert(left.bounds, to: root).minX
                    < right.convert(right.bounds, to: root).minX
            }
    }

    private static func tableScrollers(under view: NSView) -> [NSScrollView] {
        let here = (view as? NSScrollView).flatMap { $0.documentView is NSTableView ? [$0] : nil }
        return (here ?? []) + view.subviews.flatMap { tableScrollers(under: $0) }
    }
}

private extension NSScrollView {
    /// The clip view moved to a fixed offset, and the scroller told about it.
    func holdRoster(at offset: CGFloat) {
        let held = CGPoint(x: contentView.bounds.origin.x, y: offset)
        guard contentView.bounds.origin != held else { return }
        contentView.scroll(to: held)
        reflectScrolledClipView(contentView)
    }
}
