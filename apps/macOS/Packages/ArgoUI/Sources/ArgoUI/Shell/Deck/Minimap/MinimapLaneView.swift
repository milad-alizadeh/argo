import AppKit

/// The overview lane itself: layers over the deck, and only the top ones move while the reader
/// scrolls.
///
/// The marks are a bitmap of a BAND of the miniature, rasterised when that band's content changes
/// and at no other time — `MinimapGeometry` holds no scroll offset, so a scroll inside the band
/// moves the marks layer's frame and repaints nothing. The viewport rectangle is a second layer
/// moved the same way, inside a `CATransaction` with actions disabled. The annotations are a third
/// (#382), and the only one a pointer moving over the lane ever touches.
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

    /// Where down the lane the pointer is, when it is on it (#382).
    var pointedAt: CGFloat?

    /// The Turn a still names instead, as a share of the lane — see `MinimapNaming`. Resolved
    /// against the height rather than stored as a point, because it is set before the lane has one.
    var namedShare: CGFloat?

    /// Which place down the lane is naming a Turn. The pointer wins: a real hand on the surface is
    /// never overruled by what a specimen asked for.
    var hovered: CGFloat? {
        pointedAt ?? namedShare.map { bounds.height * $0 }
    }

    /// Whether ⇧⌘ is held, which asks for every Turn at once rather than the one under the pointer.
    var holdsBothKeys = false

    /// The same asked for by a still — see `MinimapNaming`.
    var namesEveryTurn = false

    /// Whether every Turn on screen is named. Either source will do: one is a hand on the keyboard,
    /// the other is a render saying what state it is showing.
    var showsEveryPrompt: Bool {
        holdsBothKeys || namesEveryTurn
    }

    /// The modifier watch, held only while the pointer is on the lane.
    var modifierWatch: Any?

    /// What the lane is currently drawn against. Read by the pointer half, which maps a place in
    /// the lane back onto the reading through the geometry a scrub froze.
    private(set) var geometry = MinimapGeometry(MinimapReading(), lane: .zero)

    /// How many times the marks have been rasterised — the instrument #402 asks for, to show that
    /// scrolling the feed inside a band repaints no content in the lane.
    var markRedraws = 0

    /// The same instrument for the annotations, which is what shows the two are separate: a hover
    /// moves this and leaves `markRedraws` alone (#382).
    var annotationRedraws = 0

    let marksLayer = CALayer()
    /// The slice of the miniature currently held as pixels, and what was drawn into it. All three
    /// are compared before a rasterise, so a feed append outside the band costs nothing.
    var drawnBand: MinimapBand?
    var drawnMarks: [MinimapMark] = []
    /// Every ink the marks bitmap was drawn in, so a palette that did not change does not re-ink
    /// it. The whole set rather than one colour: a second appearance can move a diff ink without
    /// touching the ramp, and the lane draws both.
    var inked: [ArgoColor] = []

    /// The annotation layer (#382). Over the marks and the lit range both, because an annotation is
    /// read rather than looked at, and it is the only layer a hover ever touches.
    let annotationsLayer = CALayer()
    var drawnAnnotations: [MinimapAnnotation] = []
    /// The ink the annotations were drawn in, so a palette that did not change does not re-set
    /// them.
    var labelled: ArgoColor?

    private let viewportLayer = CALayer()
    /// The scroll knob down the lane's outer edge. The feed's own overlay scroller is switched off
    /// while the lane is up, because it would draw BETWEEN the reading and its map — so the reading
    /// keeps its scroller, and the lane is where it is drawn.
    private let scrollerLayer = CALayer()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        // The band is several lane-heights tall and hangs off both ends of the lane by design, so
        // the host clips it. Without this it paints over the deck header above and the row below.
        layer?.masksToBounds = true
        marksLayer.contentsGravity = .resize
        scrollerLayer.cornerRadius = ArgoMinimapLane.scrollerWidth / 2
        layer?.addSublayer(marksLayer)
        layer?.addSublayer(viewportLayer)
        layer?.addSublayer(scrollerLayer)
        layer?.addSublayer(annotationsLayer)
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

    /// Where the scroll knob is drawn, down the lane's outer edge.
    var scrollerFrame: CGRect {
        scrollerLayer.frame
    }

    /// Where the marks bitmap currently sits, band and all.
    var marksFrame: CGRect {
        marksLayer.frame
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
            at: geometry.viewportY(at: offset), height: geometry.viewportHeightInLane,
        )
        settleScroller(over: viewportLayer.frame)
        settleAnnotations()
        CATransaction.commit()
    }

    /// The knob stands for the same range the lit area does, so the two can never disagree about
    /// where the reader is. Inside the caller's transaction, never its own.
    private func settleScroller(over lit: CGRect) {
        scrollerLayer.backgroundColor = palette?.edge.strong.cgColor
        scrollerLayer.isHidden = !geometry.isScrollable
        scrollerLayer.frame = CGRect(
            x: bounds.width - ArgoMinimapLane.scrollerWidth - ArgoMinimapLane.scrollerInset,
            y: lit.minY,
            width: ArgoMinimapLane.scrollerWidth,
            height: lit.height,
        )
    }

    /// A full-width lane band as AppKit wants it. Lane space counts down from the top, like the
    /// reading it maps, and AppKit counts up; the view is deliberately NOT flipped, because a
    /// flipped host flips its backing layer's geometry too and turns the marks bitmap over.
    func rect(at laneY: CGFloat, height: CGFloat) -> CGRect {
        CGRect(x: 0, y: bounds.height - laneY - height, width: bounds.width, height: height)
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
        pointedAt = nil
        holdsBothKeys = false
        stopWatchingModifiers()
        refresh()
    }

    /// The visible range as a lit AREA rather than an outline, on two rungs of one family: `wash`
    /// at rest, `muted` under the pointer. Near-white, because a coloured ground would tint the
    /// marks it covers into reading differently from the ones beside them.
    var viewportGround: CGColor? {
        guard let palette else { return nil }
        let lit = palette.text.primary
        return (isLit ? palette.state.muted(lit) : palette.state.wash(lit)).cgColor
    }
}
