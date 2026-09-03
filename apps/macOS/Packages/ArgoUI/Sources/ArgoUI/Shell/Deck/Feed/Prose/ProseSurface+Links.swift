import AppKit
import ProseText

/// One link's words where they actually landed, in the surface's own coordinates.
///
/// A run and not a link is the unit: a single link that wraps occupies more than one rectangle, and
/// a pointer over the second half of it is still a pointer over the link.
struct ProseLinkPlace: Equatable {
    var url: URL
    var rect: CGRect
}

// Links, hit-tested on the very frame that drew them (ADR-0030, Rule 8). SwiftUI drew a link run
// inside a `Text` and stopped there — no pointer over it — and the rectangle had to come back out
// of a renderer. Here the rectangle is already known: it is where the glyphs were inked.

extension ProseSurface {
    /// Every link of every wrapping block, placed. Taken off the marks the agent's own
    /// `[text](url)` made, never a reading of the prose.
    @MainActor static func places(in placed: FeedProseFrame) -> [ProseLinkPlace] {
        placed.parts.flatMap { part -> [ProseLinkPlace] in
            guard case let .words(run, _, indent) = part.part else { return [] }
            // Held inside the row. A run's typographic box is the FONT's ascent over its descent,
            // which stands a little proud of the line box the rhythm is counted at — so the first
            // line's box reaches above the row it is in, and a target there would be a press on the
            // row above.
            let row = CGRect(x: 0, y: 0, width: part.rect.width, height: placed.height)
            return run.spans.compactMap { span in
                guard let url = span.url else { return nil }
                let rect = span.rect
                    .offsetBy(dx: part.rect.minX + indent, dy: part.rect.minY)
                    .intersection(row)
                return rect.isNull ? nil : ProseLinkPlace(url: url, rect: rect)
            }
        }
    }

    /// The link under `point`, or nothing. A hit outside every run's rectangle does nothing at all.
    func link(at point: CGPoint) -> URL? {
        links.first { $0.rect.contains(point) }?.url
    }

    /// Transparent to everything that is not a link. A surface taking the whole row would swallow
    /// the press that selects it and the menu that copies it; a hosted block keeps its own hits,
    /// which is what makes a fence scrollable and a diagram's caption selectable.
    override func hitTest(_ point: NSPoint) -> NSView? {
        if let hosted = super.hitTest(point), hosted !== self {
            return hosted
        }
        return link(at: convert(point, from: superview)) == nil ? nil : self
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        for place in links {
            addCursorRect(place.rect, cursor: .pointingHand)
        }
    }

    override func mouseDown(with event: NSEvent) {
        guard let url = link(at: convert(event.locationInWindow, from: nil)) else {
            super.mouseDown(with: event)
            return
        }
        open(url)
    }
}
