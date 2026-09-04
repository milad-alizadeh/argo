/// Which of the measure's three bands a value falls in — the traffic light the map is coloured by.
///
/// The cuts are the contract's (`ArgoPalette.MeasureRoles`), spelled again here because
/// `AtlasLayout` depends on no contract: the layout half decides sizes and bands, and the pigment a
/// band resolves to is spent on a pixel. `AtlasBandContractTests`, over in the drawing half, is
/// what holds the two declarations together — the arrangement `AtlasVolumeTests` already holds
/// the shader's struct with.
public enum AtlasBand: Equatable, Sendable {
    /// Half the files.
    case quiet
    /// The band between the two.
    case middling
    /// The top 15%.
    case hot

    /// Where green gives way to amber: half the files are quiet.
    package static let middlingFrom = 0.5
    /// Where amber gives way to red: the top 15% are hot.
    package static let hotFrom = 0.85

    /// The band at a point along the measure, 0 at the bottom of the repository's distribution.
    ///
    /// A point ON a cut belongs to the QUIETER band, which is `ArgoRamp.color(at:)`'s own
    /// arithmetic rather than a rounding preference: a repository where half the files share one
    /// value has that whole mass sitting exactly on a cut, and reporting it up would paint half the
    /// map amber.
    public init(at fraction: Double) {
        self = if fraction > Self.hotFrom {
            .hot
        } else if fraction > Self.middlingFrom {
            .middling
        } else {
            .quiet
        }
    }
}
