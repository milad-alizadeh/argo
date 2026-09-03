import AppKit
import ArgoDesign
import ProseText

// The glyphs. Everything a prose row is made of except the three blocks that lay themselves out,
// inked from the frame that measured them — see `ProseSurface`.

extension ProseSurface {
    override func draw(_ dirty: NSRect) {
        super.draw(dirty)
        guard let context = NSGraphicsContext.current?.cgContext, let showing else { return }
        let ink = showing.ink
        let marked = ink.voiced(showing.marker)
        for part in placed.parts {
            guard case let .words(run, marker, indent) = part.part else { continue }
            guard part.rect.intersects(dirty) else { continue }
            marker?.draw(
                at: CGPoint(x: markerLeft(of: marker), y: part.rect.minY),
                ink: marked,
                in: context,
            )
            run.draw(
                at: CGPoint(x: part.rect.minX + indent, y: part.rect.minY),
                ink: ink,
                in: context,
            )
        }
    }

    /// A list item's marker, trailing-aligned in its own fixed column, so `9.` and `10.` set their
    /// words on one vertical — `FeedMarker`'s own rule, and the one the overview lane lays out
    /// with.
    @MainActor func markerLeft(of marker: ProseRun?) -> CGFloat {
        guard let line = marker?.lines.first else { return 0 }
        let width = min(
            ArgoFeedRow.markerWidth,
            CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)),
        )
        return ArgoFeedRow.markerWidth - width
    }
}
