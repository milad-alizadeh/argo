import SwiftUI

/// Layer 2 of the token contract: every colour named by the JOB it does, bound to a `Ramp`
/// step. A view names a job — `Palette.statusFail` — and never a step, which is what makes
/// a palette change one edit here instead of a sweep through the app.
///
/// **Dark only, deliberately.** Penumbra is drawn in the dark (`docs/designs/`), and this
/// app has no light surfaces yet. The Electron contract binds the same names a second time
/// for light; when a light theme is wanted here, this enum's `static let`s become a
/// scheme-resolving lookup and nothing at the call sites changes. That is the whole reason
/// the values are behind names.
public enum Palette {
    // MARK: - Ground and ink

    public static let background = Ramp.graphite850
    public static let foreground = Ramp.bone200

    public static let card = Ramp.graphite800
    public static let popover = Ramp.graphite700

    /// Ink ladder: foreground → bright (emphasised values) → soft (long-dwell reading) →
    /// muted → faint (metas).
    public static let foregroundBright = Ramp.bone50
    public static let foregroundSoft = Ramp.bone300
    public static let foregroundMuted = Ramp.bone500
    public static let foregroundFaint = Ramp.bone700

    // MARK: - Accent

    /// Gold means attention, and nothing else. `soft` is the agent/auto presence ink.
    public static let primary = Ramp.gold500
    public static let primaryForeground = Ramp.graphite950
    public static let primaryBright = Ramp.gold300
    public static let primarySoft = Ramp.gold700

    public static let secondary = Ramp.graphite600
    public static let secondaryForeground = Ramp.bone300

    /// Selection and hover are an INK wash, never gold: `accent` is hover, `accentStrong`
    /// is the current row. Nothing else marks selection — no lip, no border, no shift.
    public static let accent = Ramp.bone100.opacity(0.03)
    public static let accentStrong = Ramp.bone100.opacity(0.06)
    public static let accentForeground = Ramp.bone100

    public static let destructive = Ramp.terracotta500
    public static let border = Ramp.bone100.opacity(0.06)
    public static let input = Ramp.bone100.opacity(0.09)
    public static let ring = Ramp.gold500

    // MARK: - Surfaces

    /// One frosted surface per region (the panel); flat inset cards live inside it. A
    /// second blurred layer over this one is the mistake this token exists to prevent.
    public static let panel = Ramp.graphite700.opacity(0.50)
    public static let inset = Ramp.bone100.opacity(0.03)
    public static let insetHair = Ramp.bone100.opacity(0.06)
    public static let insetLip = Ramp.bone100.opacity(0.05)
    /// A live card's fill falls from its lit lip to its foot rather than sitting flat. The
    /// two stops average `inset`, so the card gains the fall without gaining weight.
    public static let insetTop = Ramp.bone100.opacity(0.05)
    public static let insetBottom = Ramp.bone100.opacity(0.015)

    // MARK: - The plane

    /// The signature Penumbra card: a cool translucent slab with a CONCEALED cove lip along
    /// its top edge and a warm bloom washing in from above. `lit` is the driven plane — the
    /// session you are in — which warms and gains an outer spill. Depth is carried by
    /// brightness only (see `Motion.recede`), never by scale or offset.
    public static let planeTop = Ramp.graphite500.opacity(0.42)
    public static let planeBottom = Ramp.graphite700.opacity(0.50)
    public static let planeTopLit = Ramp.bone700.opacity(0.55)
    public static let planeBottomLit = Ramp.graphite600.opacity(0.60)
    public static let coveLip = Ramp.bone100.opacity(0.05)
    public static let coveLipLit = Ramp.bone100.opacity(0.12)
    public static let bloomWarm = Ramp.gold500.opacity(0.14)
    public static let bloomWarmLit = Ramp.gold500.opacity(0.30)
    public static let planeCast = Color.black.opacity(0.70)
    public static let planeCastLit = Color.black.opacity(0.78)

    // MARK: - The room

    /// The dust scrim: a multiply pass over the whole scene.
    public static let scrimEdge = Color.black.opacity(0.34)
    public static let scrimTop = Color.black.opacity(0.22)
    public static let scrimBottom = Color.black.opacity(0.40)

    /// The lit scene every plane floats on, and is lit BY. The orb's warm corona off-centre
    /// right, a wider wash behind it, a cool fill low-left so the room is not one hue, and a
    /// lift along the top.
    public static let sceneCorona = Ramp.gold500.opacity(0.13)
    public static let sceneCoronaWide = Ramp.gold500.opacity(0.05)
    public static let sceneCool = Ramp.graphite500.opacity(0.40)
    public static let sceneLift = Ramp.graphite700
    /// The dither's weight. A shallow ramp over a near-black ground bands without it.
    public static let grain = 0.035

    public static let well = Color.black.opacity(0.15)
}
