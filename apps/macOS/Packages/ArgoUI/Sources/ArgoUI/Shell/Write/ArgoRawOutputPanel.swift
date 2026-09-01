import CoreGraphics

/// What the raw-output panel measures. Beside the surface rather than in the contract: these are
/// this one panel's content measures, not roles anything else sets (#756).
enum ArgoRawOutputPanel {
    /// Eighty monospaced columns at the body rung — the width a terminal gives git, and therefore
    /// the width git wrapped its own hints for. Narrower and every hint re-wraps; wider and the
    /// panel is mostly empty.
    static let width: CGFloat = 624
    /// A screenful. Output runs to any length — occasionally enormous, which §5 accepts — so the
    /// panel scrolls past this rather than growing until it leaves the window.
    static let maxHeight: CGFloat = 320
}
