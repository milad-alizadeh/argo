import CoreGraphics

/// The spacing rhythm — the nine steps the design actually uses — plus the structural boxes
/// that are NOT rhythm steps: a fixed column is sized to what must fit in it, and stays that
/// width as the rows around it change.
public enum Space {
    public static let hair: CGFloat = 2
    public static let tight: CGFloat = 4
    public static let snug: CGFloat = 6
    public static let gap: CGFloat = 8
    /// A list row's own vertical inset — the density's smallest padding.
    public static let row: CGFloat = 10
    public static let inset: CGFloat = 12
    public static let region: CGFloat = 16
    /// A floating plane's own inset, one step above a region.
    public static let plane: CGFloat = 20
    /// How far a tree's children sit in from their parent row. Above the region step because
    /// it is a structural offset, not a gap between neighbours.
    public static let nest: CGFloat = 24

    // MARK: - Structural columns

    /// One fixed box shared by a tree row's caret and its glyph, so the two centre on the
    /// same vertical axis. One marker box (16) + one row gap (8) = one `nest`, which is what
    /// makes each tree level step by exactly one nesting unit.
    public static let markerColumn: CGFloat = 16
    /// The box a feed row's kind label sits in, so the content beside it starts on ONE axis
    /// down the whole feed. Sized to the longest kind word at the `tag` role. Too narrow is
    /// not a cosmetic miss: the label overruns the content and the two paint over each other.
    public static let kindColumn: CGFloat = 52
    /// The box a plan entry's or feed row's glyph sits in, so a dozen different marks down a
    /// list never shift the text beside them.
    public static let markColumn: CGFloat = 16
    /// The left padding of a feed row's opened box, so its first character sits under the
    /// row's GLYPH rather than under the caret that opened it. Derived from the two things it
    /// depends on, so it cannot drift out of alignment when either changes.
    public static let bodyInset: CGFloat = markColumn + snug

    // MARK: - Chrome geometry

    /// Structural boxes rather than rhythm steps: they hold the shell's columns, and the
    /// traffic-light reserve is fixed by macOS rather than by the design.
    public static let projectStripWidth: CGFloat = 60
    public static let projectTabSize: CGFloat = 38
    public static let trafficLightsClearance: CGFloat = 52
    /// The session header's context ring — sized to be glanceable across the band.
    public static let contextRingSize: CGFloat = 56

    // MARK: - Vertical measures

    /// The density's vertical half, as the prototypes measured it.
    public static let rowHeightTight: CGFloat = 20
    public static let rowHeight: CGFloat = 22
    /// The one shared strip height, so a tab strip and a lifecycle strip stack with no seam.
    public static let stripHeight: CGFloat = 38
    /// The pane header band. A stated constant rather than whatever each header's contents
    /// happen to measure, because the chapter seam and the rail's header are meant to read as
    /// ONE rule across the surface — and shrink-wrapped they missed each other by two pixels,
    /// which reads as a join that broke rather than as a rule that continues.
    public static let bandHeight: CGFloat = 31

    /// How tall an opened tool output stands before it scrolls inside itself. A bound rather
    /// than a truncation: a thousand-line log would swallow the prose beside it, and cutting
    /// it would hide the tail, which for a stack trace is the part that names the cause.
    public static let outputMaxHeight: CGFloat = 220
    /// How tall an inline image stands. Taller than an output block because a screenshot IS
    /// the fact, and a full-window shot squeezed to a dozen lines is unreadable.
    public static let mediaMaxHeight: CGFloat = 420
}
