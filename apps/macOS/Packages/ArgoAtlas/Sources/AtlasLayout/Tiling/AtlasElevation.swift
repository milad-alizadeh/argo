import CoreGraphics

/// How tall a file stands, in the points its footprint was tiled in (#1150).
///
/// `AtlasFraming`'s sibling and, like it, a reader of no contract: a height is the tiling's own
/// arithmetic. Both ends are a SHARE of the ground rather than a fixed number of points, because
/// the map is tiled into whatever room the room has — a ceiling of 150 points is a skyline on a
/// small window and a rug on a large one, and the picture would change with the window.
///
/// The share is measured off the SHORTER side. A tower measured off the longer side of a wide map
/// overhangs the short one, and a skyline that leaves the frame is a skyline nobody can compare.
package enum AtlasElevation {
    /// How much of the ground the tallest file stands: the design's own 150 units of a 1000-unit
    /// plan (`docs/designs/cockpit-atlas.html`, `HMAX`).
    package static let ceilingShare: CGFloat = 0.15

    /// What a file measuring nothing stands: the design's 2 units of the same 1000.
    ///
    /// A slab this shallow reads as a flat tile at every camera, and it keeps a roof off the exact
    /// plane of the plate under it. What ORDERS that pair is the plan's own order — the pipeline is
    /// `lessEqual` and plates are handed over first — so this is a rounding margin under it rather
    /// than the thing the picture depends on.
    static let floorShare: CGFloat = 0.002

    /// The tallest a file stands on this ground. `package` because a cast shadow (#1151) reads a
    /// file's height as a SHARE of this same ceiling — the shadow's own throw is a plan-relative
    /// number for the reason the height it answers to is, and the drawing half has no ceiling of
    /// its own to duplicate this one with.
    package static func ceiling(of extent: CGSize) -> CGFloat {
        min(extent.width, extent.height) * ceilingShare
    }

    /// The shallowest a file stands on this ground. `package` because the RISE starts every box
    /// here rather than at nothing (#1421): a box on the exact plane of its plate is the one thing
    /// the note above says this number exists to avoid, and a rise that began at zero would put
    /// every box in the map there at once.
    package static func floor(of extent: CGSize) -> CGFloat {
        min(extent.width, extent.height) * floorShare
    }

    /// How tall one file stands: its share of the greatest value measured for the height Measure,
    /// against the ceiling, and never below the floor.
    ///
    /// Nothing when the Plot carries no value, and nothing when NO Plot does — the second is the
    /// division this has to answer rather than perform, because a zero tallest reaches the shader
    /// as a NaN and a NaN takes the whole city with it.
    static func height(of value: Double?, tallest: Double, on extent: CGSize) -> CGFloat {
        guard let value, tallest > 0 else { return floor(of: extent) }
        let share = max(0, min(1, value / tallest))
        return max(floor(of: extent), ceiling(of: extent) * CGFloat(share))
    }
}
