import AppKit

/// The overview lane itself: layers over the deck, and only the top ones move while the reader
/// scrolls.
///
/// The rects are a bitmap of a BAND of the miniature, rasterised when that band's content changes
/// and at no other time — `MinimapGeometry` holds no scroll offset, so a scroll inside the band
/// moves the rects layer's frame and repaints nothing. The viewport rectangle is a second layer
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

    /// Whether the reader asked for Increased Contrast, which lifts the runs' alpha so the rects
    /// clear the surface they sit on.
    var raisesContrast = false {
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

    /// What a still asks the lane to name instead of a pointer — see `MinimapNaming`.
    var naming = MinimapNaming.nothing {
        didSet { settleAnnotations() }
    }

    /// Which place down the lane is naming a Turn. The pointer wins: a real hand on the surface is
    /// never overruled by what a specimen asked for. A still's share is resolved against the height
    /// here rather than stored as a point, because it is set before the lane has one.
    var hovered: CGFloat? {
        pointedAt ?? naming.share.map { bounds.height * $0 }
    }

    /// Whether ⇧⌘ is held, which asks for every Turn at once rather than the one under the pointer.
    var holdsBothKeys = false

    /// Whether every Turn on screen is named. Either source will do: one is a hand on the keyboard,
    /// the other is a render saying what state it is showing.
    var showsEveryPrompt: Bool {
        holdsBothKeys || naming == .everyTurn
    }

    /// The modifier watch, held only while the pointer is on the lane.
    var modifierWatch: Any?

    /// What the lane is currently drawn against. Read by the pointer half, which maps a place in
    /// the lane back onto the reading through the geometry a scrub froze.
    private(set) var geometry = MinimapGeometry(MinimapReading(), lane: .zero)

    /// The reading height the lane has already answered a reshape at. The reading reports every
    /// `setFrame` on itself, so this is what tells a reshape from a report carrying nothing.
    var reshapedTo: CGFloat?

    /// The document the lane last read, and the stamp it was true at.
    ///
    /// Held because the two halves of `refresh` have wildly different costs: re-deriving the
    /// geometry for a lane that merely resized is arithmetic over rows already read, and re-READING
    /// the document is a `ProseReading.structure` per row plus a ruler measure for every height the
    /// feed does not already know. See `MinimapReadingStamp` for why a height is not a sound stamp.
    private var read: MinimapReading?
    private var readAt: MinimapReadingStamp?
    /// Whether a pass has already asked for another one — see `waitForSettle()`.
    private var isWaiting = false

    #if DEBUG
        /// How many times the whole-document geometry has been derived — the counter ADR-0028
        /// Rule 7 asks for, and what "no geometry rebuild across a scroll" is measured with (#955).
        /// DEBUG for the reason `FeedPaneCost` states.
        private(set) var geometryDerivations = 0
        /// How many reshape notices arrived, so a claim about the two can say which burst it was
        /// made over rather than assuming one happened. Written by the pointer half, like the two
        /// redraw counts below it.
        var reshapeNotices = 0
        /// How many WHOLE-DOCUMENT readings were taken — a `MinimapRow` per row of the document,
        /// each one a `ProseReading.structure`, and a ruler measure for every row whose height is
        /// not already known. A derivation is not a walk: the geometry is re-derived for a lane
        /// that merely resized, off a reading that has not moved.
        private(set) var readingWalks = 0
    #endif

    /// How many times the rects have been BUILT, which the rasterise count cannot say: the whole
    /// point of the derivation stamp is that a frame skips the build and reaches no rasterise
    /// either way. This is what "a scroll inside the band costs nothing" is measured with.
    var rectBuilds = 0

    /// How many times the rects have been rasterised — the instrument #402 asks for, to show that
    /// scrolling the feed inside a band repaints no content in the lane.
    var rectRedraws = 0

    /// The same instrument for the annotations, which is what shows the two are separate: a hover
    /// moves this and leaves `rectRedraws` alone (#382).
    var annotationRedraws = 0

    let rectsLayer = CALayer()
    /// What holds the rects inside the lane. The band hangs off both ends of it by several lane
    /// heights, and without this it would paint over the deck header above and the row below.
    private let rectsClip = CALayer()
    /// How many times the geometry has been derived. Everything the rects are built from lives in
    /// it, so a band painted at this number is already the pixels a fresh build would produce.
    private(set) var derivation = 0
    /// The derivation the pixels on `rectsLayer` were built from, which is what lets a scroll skip
    /// building rects to prove they did not change (#963).
    var paintedAt: Int?
    /// The slice of the miniature currently held as pixels, and what was drawn into it. All three
    /// are compared before a rasterise, so a feed append outside the band costs nothing.
    var drawnBand: MinimapBand?
    var drawnRects: [MinimapRect] = []
    /// Every ink the rects bitmap was drawn in, so a palette that did not change does not re-ink
    /// it. The whole set rather than one colour: a second appearance can move a diff ink without
    /// touching the ramp, and the lane draws both.
    var inked: [ArgoColor] = []

    /// The annotation layer (#382). Over the rects and the lit range both, because an annotation is
    /// read rather than looked at, and it is the only layer a hover ever touches.
    let annotationsLayer = CALayer()
    /// What the lane is marking right now. The lane's rendered output is a bitmap, so this is the
    /// form in which it can say what went into one — and it is what a repaint is compared against.
    /// Written by `settleAnnotations` and read everywhere else.
    var marking: [MinimapAnnotation] = []
    /// Every ink the annotations were drawn in, so a palette that did not change does not re-set
    /// them — and one that moved any of the three does.
    var labelled: [ArgoColor] = []

    /// The lit rectangle, which IS this reading's scrollbar — the feed's own overlay scroller stays
    /// off, because it would draw between the reading and its map.
    private let viewportLayer = CALayer()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        // The band is several lane-heights tall and hangs off both ends of the lane by design, so
        // something has to clip it — but NOT the host, because a Turn's label is drawn to the left
        // of the lane where there is room to read it whole. So the rects get a clipping layer of
        // their own and the host lets its sublayers out.
        rectsClip.masksToBounds = true
        rectsLayer.contentsGravity = .resize
        rectsClip.addSublayer(rectsLayer)
        layer?.addSublayer(rectsClip)
        layer?.addSublayer(viewportLayer)
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

    /// Where the rects bitmap currently sits, band and all.
    var rectsFrame: CGRect {
        rectsLayer.frame
    }

    /// Whether the rects are held inside the lane while the annotations are let OUT of it. Both
    /// halves at once, because that is the claim: the band may not paint over the deck around it,
    /// and a Turn's label must still reach the reading beside it.
    var clipsRectsOnly: Bool {
        rectsClip.masksToBounds && layer?.masksToBounds == false
    }

    /// The reading re-read and the lane put where it now sits.
    ///
    /// Called when the reading changes shape, when the lane is resized, and when a scrub lets go.
    /// Never on a scroll. Mid-scrub it does nothing at all: rows arriving under a hand would
    /// otherwise re-scale the lane the hand is holding.
    func refresh() {
        guard grab == nil, let stamp = feed?.readingStamp() else { return }
        guard let reading = reading(at: stamp) else { return }
        #if DEBUG
            geometryDerivations += 1
        #endif
        // Read off the same view the reshape notice carries, so the two cannot disagree about
        // which height the lane has already answered.
        reshapedTo = watched?.documentView?.frame.height
        geometry = MinimapGeometry(reading, lane: bounds.size)
        derivation += 1
        settleViewport()
    }

    /// The document as it stands — walked only where the stamp says a walk would find something
    /// different from what is held.
    ///
    /// Two reasons to answer nothing, and neither of them draws: a feed with no table to read, and
    /// a feed whose heights are provisional. The second is the burst case: a width frame retires
    /// every measured height, so a walk taken inside one re-measures the whole document, once per
    /// frame, while the feed itself is deliberately measuring only what the reader can see. What
    /// the lane holds stands until the burst settles — but only ever a reading of THIS document,
    /// and only where it has one: with nothing held it walks, burst or no burst.
    private func reading(at stamp: MinimapReadingStamp) -> MinimapReading? {
        if let read, readAt == stamp {
            return read
        }
        if read != nil, stamp.isProvisional, readAt?.isOfSameDocument(as: stamp) == true {
            return waitForSettle()
        }
        #if DEBUG
            readingWalks += 1
        #endif
        guard let walked = feed?.reading(at: stamp) else { return nil }
        read = walked
        // Stamped AFTER the walk. The walk measures every height it did not find, so the count it
        // set out from is already stale by the time it returns — and what it returns is true of the
        // heights it took, not of the ones it went looking for. Nothing else in a stamp can move
        // under a walk, which is why re-taking it is a record rather than a second question.
        readAt = feed?.readingStamp() ?? stamp
        return walked
    }

    /// Nothing this pass, and another pass next turn of the run loop.
    ///
    /// A burst ends without announcing it, so the lane asks again rather than waiting to be told —
    /// one stamp a turn instead of one whole document a turn. The re-arm is what stops the wait
    /// being permanent, and it is asked for on the NEXT turn because AppKit is inside this view's
    /// layout right now. `reshapedTo` is left alone by this path, so a reshape the wait swallowed
    /// still lands.
    private func waitForSettle() -> MinimapReading? {
        guard !isWaiting else { return nil }
        isWaiting = true
        DispatchQueue.main.async { [weak self] in
            self?.isWaiting = false
            self?.needsLayout = true
        }
        return nil
    }

    /// Both layers moved to where the reading now sits. No implicit animation — a rectangle easing
    /// after a wheel would lag the reading it stands for.
    func settleViewport() {
        let offset = feed?.offset() ?? 0
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        rectsClip.frame = bounds
        placeRects(slidTo: geometry.laneOffset(at: offset))
        viewportLayer.backgroundColor = viewportGround
        viewportLayer.isHidden = !geometry.isScrollable
        viewportLayer.frame = rect(
            at: geometry.viewportY(at: offset), height: geometry.viewportHeightInLane,
        )
        settleAnnotations()
        CATransaction.commit()
    }

    /// A full-width lane band as AppKit wants it. Lane space counts down from the top, like the
    /// reading it maps, and AppKit counts up; the view is deliberately NOT flipped, because a
    /// flipped host flips its backing layer's geometry too and turns the rects bitmap over.
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
        paintedAt = nil
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
    /// rects it covers into reading differently from the ones beside them.
    var viewportGround: CGColor? {
        guard let palette else { return nil }
        let lit = palette.text.primary
        return (isLit ? palette.state.muted(lit) : palette.state.wash(lit)).cgColor
    }
}
