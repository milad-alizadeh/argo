import AppKit

/// The overview lane itself: two layers over the deck, and only the top one moves while the reader
/// scrolls.
///
/// The marks are a bitmap rasterised when the reading changes SHAPE and at no other time —
/// `MinimapGeometry` holds no scroll offset, so nothing about a scroll can invalidate it. The
/// viewport rectangle is a layer whose frame is set inside a `CATransaction` with actions disabled,
/// which is a compositor move rather than a repaint. #382 adds a third layer above these for D25's
/// annotations without touching either.
final class MinimapLaneView: NSView {
    /// The feed this lane maps. Weak, because the handle belongs to the deck above both of them.
    weak var feed: FeedTableHandle?

    /// How long a click's scroll takes. `nil` lands it instantly — Reduce Motion, where the whole
    /// content of the change is the movement.
    var pace: TimeInterval?

    /// The colours the lane is drawn in, from the environment the deck reads. Nothing is drawn
    /// before one arrives: a palette named here would be one appearance baked into a view.
    var palette: ArgoPalette? {
        didSet { redress() }
    }

    /// Where inside the viewport rectangle a scrub was picked up — and, by being set at all, that
    /// one is in progress. The scale is frozen for as long as it is.
    var grab: CGFloat?

    /// The scroll view being watched, so attaching twice to the same one does nothing.
    var watched: NSScrollView?

    /// What the lane is currently drawn against. Read by the pointer half, which maps a place in
    /// the lane back onto the reading through the geometry a scrub froze.
    private(set) var geometry = MinimapGeometry(MinimapReading(), laneHeight: 0)

    /// How many times the marks have been rasterised — the instrument #402 asks for, to show that
    /// scrolling the feed repaints no content in the lane.
    private(set) var markRedraws = 0

    private let marksLayer = CALayer()
    private let viewportLayer = CALayer()
    /// The ink the marks bitmap was drawn in, so a palette that did not change does not re-ink it.
    private var inked: ArgoColor?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        marksLayer.contentsGravity = .resize
        viewportLayer.borderWidth = ArgoStroke.border
        layer?.addSublayer(marksLayer)
        layer?.addSublayer(viewportLayer)
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("MinimapLaneView is built in code, never from a nib.")
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// Where the viewport rectangle is drawn — the lane's one moving part.
    var viewportFrame: CGRect {
        viewportLayer.frame
    }

    /// The reading re-read, the marks re-rasterised if its shape moved, the rectangle put where the
    /// reading sits.
    ///
    /// Called when the reading changes shape, when the lane is resized, and when a scrub lets go.
    /// Never on a scroll. Mid-scrub it does nothing at all: rows arriving under a hand would
    /// otherwise re-scale the lane the hand is holding.
    func refresh() {
        guard grab == nil, let reading = feed?.reading() else { return }
        let fresh = MinimapGeometry(reading, laneHeight: bounds.height)
        if fresh != geometry {
            geometry = fresh
            drawMarks()
        }
        settleViewport()
    }

    /// The viewport rectangle moved to where the reading now sits. No repaint, and no implicit
    /// animation — a rectangle easing after a wheel would lag the reading it stands for.
    func settleViewport() {
        let height = geometry.viewportHeightInLane
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        viewportLayer.isHidden = !geometry.isScrollable
        viewportLayer.frame = rect(
            at: geometry.viewportY(at: feed?.offset() ?? 0), height: height, inset: 0,
        )
        CATransaction.commit()
    }

    /// A lane-space band as AppKit wants it. Lane space counts down from the top, like the reading
    /// it maps, and AppKit counts up; the view is deliberately NOT flipped, because a flipped host
    /// flips its backing layer's geometry too and turns the marks bitmap over.
    func rect(at laneY: CGFloat, height: CGFloat, inset: CGFloat) -> CGRect {
        CGRect(
            x: inset,
            y: bounds.height - laneY - height,
            width: bounds.width - inset * 2,
            height: height,
        )
    }

    override func layout() {
        super.layout()
        refresh()
    }

    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        drawMarks()
    }

    /// The hand is off the lane whatever happened to it — a drag interrupted by the window going
    /// away never gets its `mouseUp`, and a scrub left open would freeze the scale for good.
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        grab = nil
        refresh()
    }

    /// D25's quiet neutral line: the dimmest rung of the ramp, because a lane at a real session's
    /// length is nearly solid with marks and is read at a glance beside the reading, never instead
    /// of it. A rung is a loudness here, not a meaning (`rules/design-system.md`).
    private var markInk: ArgoColor? {
        palette?.text.disabled
    }

    private func redress() {
        guard let palette else { return }
        viewportLayer.backgroundColor = palette.state.wash(palette.interaction.accent).cgColor
        viewportLayer.borderColor = palette.interaction.selectionIndicator.cgColor
        // The marks are pixels rather than a colour the compositor can swap, so a second
        // appearance re-inks them — and only a second appearance does.
        if inked != markInk {
            drawMarks()
        }
    }

    /// The marks rasterised once, at the screen's own scale.
    private func drawMarks() {
        guard let ink = markInk else { return }
        markRedraws += 1
        inked = ink
        // Two before the view has a window to ask: the lane is only ever built on a Retina Mac,
        // and a wrong guess costs one re-rasterise from `viewDidChangeBackingProperties`.
        let scale = window?.backingScaleFactor ?? 2
        marksLayer.frame = bounds
        marksLayer.contentsScale = scale
        marksLayer.contents = markBitmap(inked: ink, at: scale)
    }

    private func markBitmap(inked ink: ArgoColor, at scale: CGFloat) -> CGImage? {
        guard bounds.width > ArgoMinimapLane.markInset * 2, bounds.height > 0,
              let context = CGContext(
                  data: nil,
                  width: Int(bounds.width * scale),
                  height: Int(bounds.height * scale),
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue,
              )
        else {
            return nil
        }
        context.scaleBy(x: scale, y: scale)
        context.setFillColor(ink.cgColor)
        for mark in geometry.marks {
            context.fill(rect(at: mark.y, height: mark.height, inset: ArgoMinimapLane.markInset))
        }
        return context.makeImage()
    }
}
