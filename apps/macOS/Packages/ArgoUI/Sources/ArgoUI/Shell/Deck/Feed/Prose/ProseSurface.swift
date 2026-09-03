import AppKit
import ArgoDesign
import ProseText
import SwiftUI

/// What a prose surface is asked to show: the record's own words, the measure they wrap across, and
/// the ink they are set in.
///
/// A value rather than three arguments, so the surface can tell one showing from the next and skip
/// the rebuild — a view body is evaluated far more often than its text changes.
struct ProseShowing: Equatable {
    var text: String
    var measure: CGFloat
    var ink: ProseInk
}

/// A prose row drawn by the Core Text frame that MEASURED it (ADR-0030, Rule 2).
///
/// The height the table set this cell to and the lines inked here come out of one walk over one
/// typeset — `FeedProseFrame` — so a row cannot stand a point short of what it draws. What used to
/// be a `VStack` of `Text` runs, each sizing itself, is one draw call over lines already broken.
///
/// The blocks that lay THEMSELVES out — a fence's ground and its scrollable code, a pipe table's
/// rules, a diagram — are hosted at the frame the measure gave them, drawn by the views that
/// already draw them. Everything else is glyphs, and glyphs are this surface's own.
///
/// Rule 8's other half: `links` is the frame exposed for hit-testing, so page-wide selection can
/// later be a layer over the table rather than a property of a cell.
final class ProseSurface: NSView {
    /// Where each link's words ended up, in this view's own coordinates.
    private(set) var links: [ProseLinkPlace] = []
    /// What to do with one when it is pressed. The environment's own opener, handed in by the
    /// representable, so a link opens the way every other link in the app does.
    var open: (URL) -> Void = { NSWorkspace.shared.open($0) }

    /// The blocks placed, and what they were placed for.
    private(set) var placed = FeedProseFrame()
    private(set) var showing: ProseShowing?
    private(set) var theme: ArgoTheme = .graphite
    /// One hosting view per block that lays itself out, on the frame the measure gave it. Rebuilt
    /// in `layout()` and nowhere else: adding a subview mid-measure re-enters the layout pass this
    /// measure is part of, which AppKit ends by throwing.
    private var laid: [(view: NSHostingView<AnyView>, rect: CGRect)] = []
    private var hosted: ProseShowing?

    /// Top-down, so every offset in the frame is read the way it was counted.
    override var isFlipped: Bool {
        true
    }

    /// Nothing here has an intrinsic size worth reporting: the frame is the table's to set and the
    /// height is `FeedProseFrame`'s to state.
    override var intrinsicContentSize: NSSize {
        .zero
    }

    /// The row placed at `showing`'s measure. Skipped whole where nothing moved, which is most
    /// evaluations. PURE — it reads the stores and writes this view's own two fields, so it is safe
    /// to call from a sizing pass; everything that touches the view tree waits for `layout()`.
    @MainActor func show(_ showing: ProseShowing, theme: ArgoTheme) {
        self.theme = theme
        guard showing != self.showing else { return }
        self.showing = showing
        placed = ProseReading.frame(of: showing.text, across: showing.measure)
        links = Self.places(in: placed)
        needsLayout = true
        needsDisplay = true
    }

    /// The hosted blocks rebuilt where the row changed, and put back on their frames either way —
    /// the table sets this view's width, and a block that lays itself out is drawn across whatever
    /// it was measured at.
    override func layout() {
        super.layout()
        if hosted != showing {
            hosted = showing
            host(placed)
            window?.invalidateCursorRects(for: self)
        }
        for block in laid {
            block.view.frame = block.rect
        }
    }

    /// One hosting view per self-laying block, rebuilt whole. A prose row's own blocks change only
    /// when its words do, which is the case this is already behind.
    @MainActor private func host(_ placed: FeedProseFrame) {
        for block in laid {
            block.view.removeFromSuperview()
        }
        laid = placed.parts.compactMap { part in
            guard case let .laid(block) = part.part else { return nil }
            let view = NSHostingView(rootView: AnyView(
                FeedProseLaidBlock(block: block).argoTheme(theme),
            ))
            view.sizingOptions = []
            view.frame = part.rect
            addSubview(view)
            return (view: view, rect: part.rect)
        }
    }
}
