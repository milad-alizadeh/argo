import CoreGraphics

/// What the raw-output panel measures. `SurfaceMeasureTests` holds both claims.
enum ArgoRawOutputPanel {
    /// Wider than the widest sentence the shell sets, because this content is columnar and Argo
    /// promised not to re-flow it; narrower than the narrowest window it opens over.
    static let width: CGFloat = 624
    /// Output runs to any length, so the panel scrolls past this rather than growing out of the
    /// window.
    static let maxHeight: CGFloat = 320
}
