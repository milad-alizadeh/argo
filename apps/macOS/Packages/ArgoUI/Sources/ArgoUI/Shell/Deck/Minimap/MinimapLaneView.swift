import AppKit

/// The overview lane itself: two layers over the deck, and only the top one moves while the reader
/// scrolls.
///
/// The marks are a bitmap of a BAND of the miniature, rasterised when that band's content changes
/// and at no other time — `MinimapGeometry` holds no scroll offset, so a scroll inside the band
/// moves the marks layer's frame and repaints nothing. The viewport rectangle is a second layer
/// moved the same way, inside a `CATransaction` with actions disabled. #382 adds a third layer over
/// these for D25's annotations without touching either.
final class MinimapLaneView: NSView {
    /// The feed this lane maps. Weak, because the handle belongs to the deck above both of them.
    weak var feed: FeedTableHandle?

    /// How long a click's scroll takes. `nil` lands it instantly — Reduce Motion, where the whole
    /// content of the change is the movement.
    var pace: TimeInterval?

    /// The colours the lane is drawn in, from the environment the deck reads. Nothing is drawn
    /// before one arrives: a palette named here would be one appearance baked into a view.
    var palette: ArgoPalette? {
        didSet { settleViewport() }
    }

    /// Where inside the viewport rectangle a scrub was picked up — and, by being set at all, that
    /// one is in progress. The geometry is frozen for as long as it is.
    var grab: CGFloat?

    /// The scroll view being watched, so attaching twice to the same one does nothing.
    var watched: NSScrollView?

    /// Whether the pointer is over the lane. The lit range brightens for it, so the surface answers
    /// a hand before the hand commits to anything.
    var isLit = false

    /// What the lane is currently drawn against. Read by the pointer half, which maps a place in
    /// the lane back onto the reading through the geometry a scrub froze.
    private(set) var geometry = MinimapGeometry(MinimapReading(), lane: .zero)

    /// How many times the marks have been rasterised — the instrument #402 asks for, to show that
    /// scrolling the feed inside a band repaints no content in the lane.
    var markRedraws = 0

    let marksLayer = CALayer()
    /// The slice of the miniature currently held as pixels, and what was drawn into it. Both are
    /// compared before a rasterise, so a feed append outside the band costs nothing.
    var drawnBand: MinimapBand?
    var drawnMarks: [MinimapMark] = []
    /// The ink the marks bitmap was drawn in, so a palette that did not change does not re-ink it.
    var inked: ArgoColor?

    private let viewportLayer = CALayer()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        marksLayer.contentsGravity = .resize
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

    /// Where the marks bitmap currently sits, band and all.
    var marksFrame: CGRect {
        marksLayer.frame
    }

    /// D25's quiet neutral line: the dimmest rung of the ramp, because a lane at a real session's
    /// length is dense with marks and is read at a glance beside the reading, never instead of it.
    /// A rung is a loudness here, not a meaning (`rules/design-system.md`).
    var markInk: ArgoColor? {
        palette?.text.disabled
    }

    /// The reading re-read and the lane put where it now sits.
    ///
    /// Called when the reading changes shape, when the lane is resized, and when a scrub lets go.
    /// Never on a scroll. Mid-scrub it does nothing at all: rows arriving under a hand would
    /// otherwise re-scale the lane the hand is holding.
    func refresh() {
        guard grab == nil, let reading = feed?.reading() else { return }
        geometry = MinimapGeometry(reading, lane: bounds.size)
        settleViewport()
    }

    /// Both layers moved to where the reading now sits. No implicit animation — a rectangle easing
    /// after a wheel would lag the reading it stands for.
    func settleViewport() {
        let offset = feed?.offset() ?? 0
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        placeMarks(slidTo: geometry.laneOffset(at: offset))
        viewportLayer.backgroundColor = viewportGround
        viewportLayer.isHidden = !geometry.isScrollable
        viewportLayer.frame = rect(
            at: geometry.viewportY(at: offset), height: geometry.viewportHeightInLane, inset: 0,
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

    /// A fresh backing scale retires the pixels, whatever the band holds.
    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        drawnBand = nil
        settleViewport()
    }

    /// The hand is off the lane whatever happened to it — a drag interrupted by the window going
    /// away never gets its `mouseUp`, and a scrub left open would freeze the geometry for good.
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        grab = nil
        isLit = false
        refresh()
    }

    /// The visible range is a lit AREA rather than an outlined one — Xcode's own reading, and the
    /// right one here: the lane is a picture, and a border over a picture hides a band of it.
    ///
    /// Two rungs of one family, `wash` at rest and `muted` under the pointer. Near-white rather
    /// than the accent, because every mark under it is already a neutral and a blue ground would
    /// tint the ones it covers into meaning something the ones beside them do not.
    var viewportGround: CGColor? {
        guard let palette else { return nil }
        let lit = palette.text.primary
        return (isLit ? palette.state.muted(lit) : palette.state.wash(lit)).cgColor
    }
}
