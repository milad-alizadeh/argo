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
    /// A list marker's own quieter ink — `FeedMarker`'s. Held here rather than read off the theme
    /// at draw time, so a palette that moved is a showing that differs and a repaint that happens.
    var marker: ArgoColor
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
    /// What a link is CALLED where Argo has its own name for it — a Ticket's words (#1178), and
    /// `nil` for every link whose address is the only name it has. Read by the accessibility
    /// element and nowhere else: the glyphs are already the words the reader can see.
    var words: (URL) -> String? = { _ in nil }

    /// The blocks placed, and what they were placed for.
    private(set) var placed = FeedProseFrame()
    private(set) var showing: ProseShowing?
    private(set) var theme: ArgoTheme = .graphite
    /// One hosting view per block that lays itself out, on the frame the measure gave it. Rebuilt
    /// in `layout()` and nowhere else: adding a subview mid-measure re-enters the layout pass this
    /// measure is part of, which AppKit ends by throwing.
    private var laid: [(view: NSHostingView<AnyView>, rect: CGRect)] = []
    private var hosted: ProseShowing?
    /// What to show at a measure, once one turns up — see `reink(_:pending:)`.
    private var pending: ((CGFloat) -> ProseShowing)?

    /// Top-down, so every offset in the frame is read the way it was counted.
    override var isFlipped: Bool {
        true
    }

    /// The height the frame states, and no width of its own: words wrap across the measure they are
    /// given, so a width here would be a claim the surface is in no position to make.
    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: placed.height)
    }

    /// The palette, and what to show once a measure turns up — for the update that knows the words
    /// and the ink but not yet the width they wrap across.
    @MainActor func reink(_ theme: ArgoTheme, pending: @escaping (CGFloat) -> ProseShowing) {
        self.theme = theme
        self.pending = pending
    }

    /// The row placed at `showing`'s measure. Skipped whole where nothing moved, which is most
    /// evaluations.
    ///
    /// Safe to call from a SIZING pass: it writes this view's own fields and marks it for layout,
    /// and touches no subview. Adding one mid-measure re-enters the layout pass the measure is part
    /// of, which AppKit ends by throwing.
    @MainActor func show(_ showing: ProseShowing, theme: ArgoTheme) {
        self.theme = theme
        guard showing != self.showing else { return }
        self.showing = showing
        placed = ProseReading.frame(of: showing.text, across: showing.measure)
        links = Self.places(in: placed)
        invalidateIntrinsicContentSize()
        needsLayout = true
        needsDisplay = true
    }

    /// The hosted blocks rebuilt where the row changed, and put back on their frames either way —
    /// the table sets this view's width, and a block that lays itself out is drawn across whatever
    /// it was measured at.
    override func layout() {
        super.layout()
        // The measure of last resort. A container that never proposed a width still gives this view
        // one by laying it out, and a row placed across nothing would draw nothing for ever.
        if showing == nil, bounds.width > 0, let pending {
            show(pending(bounds.width), theme: theme)
        }
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
