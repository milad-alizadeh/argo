import ArgoDesign
import AtlasLayout
import CoreGraphics

/// The table the city stands on, as the light laid on it (#1600).
///
/// Drawn, not implied. The design's floor is four things in one pass — a graded ground, the plates'
/// own light on it, a contour grid at two weights, and a vignette (`drawFloor`) — and the first and
/// the last are screen-space fills the shader solves for itself (`AtlasGround`). What is left is
/// what has to be geometry, because it depends on where the plates are, and this is it.
///
/// Pure, and separated from the renderer for the reason `AtlasVolumes` is: where a plate's light
/// lands and how hard needs no GPU to be checked, and `AtlasFloorTests` is what checks it.
enum AtlasFloor {
    /// How hard the outermost plate lights the floor under it.
    ///
    /// The design's own weight is 0.018 of a brighter cyan than the contract has (`drawFloor`,
    /// `rgba([70, 175, 205], 0.018 / ...)`). The contract already names the floor's light — `fog`,
    /// "the floor's own light, which the contour grid takes" — so the pigment is `fog` and the
    /// weight is the one that lands the SAME contribution on the ground: 0.018 of (70, 175, 205)
    /// is (1.26, 3.15, 3.69) of 255, and `fog` at 0.056 is (1.46, 2.91, 3.58). The page's two raw
    /// cyans are the floor's light from before the contract had a name for it.
    static let plateLight = 0.056

    /// How fast that light falls away with nesting, from the design's own `1 + depth * 0.45`.
    ///
    /// It STACKS rather than being summed here: two patches over one pixel composite in the blend,
    /// so a deeply nested corner of the repository sits over more plates than a shallow one and
    /// comes out brighter for it, with nothing counting depth. What this does is keep each plate's
    /// own share falling, or a tree 86 folders deep turns the ground into a flight of steps.
    static let plateFalloff = 0.45

    /// The contour grid: a fine lattice in the floor's own light and a coarser one over it, so the
    /// floor reads as contours rather than as graph paper. Drawn in this order, which is the
    /// design's.
    ///
    /// The coarse weight is the design's 0.055 of the same brighter cyan, put back onto `fog` the
    /// way `plateLight` is: 0.055 of (80, 178, 205) is (4.4, 9.8, 11.3) of 255, and `fog` at 0.178
    /// is (4.6, 9.3, 11.4). The fine one is already `fog` in the page and is its own number.
    static let grid: [(divisions: Int, weight: Double)] = [(32, 0.10), (8, 0.178)]

    /// How far the floor runs: the plan, and a margin past it. Just past the footprint — a floor
    /// that reaches the edge of the picture is the subject, and the model is what the reader came
    /// for. The margin is a share of the SHORTER side, which is the side every other plan-relative
    /// measure here is taken off (`AtlasElevation`).
    static func extent(of plan: CGSize) -> CGRect {
        let pad = min(plan.width, plan.height) * AtlasElevation.padShare
        return CGRect(origin: .zero, size: plan).insetBy(dx: -pad, dy: -pad)
    }

    /// Every patch of light on this floor, in the order they are drawn: each plate's own light
    /// first, then the grid over it.
    ///
    /// A plate lights the floor from its WHOLE rect, frame included — it is the folder's own
    /// footprint casting light down, not the ground its files stand on, so nothing here shrinks it
    /// by the border `AtlasVolumes` spends on the rim.
    static func patches(of plan: AtlasPlan, in pigments: AtlasPigments) -> [AtlasFloorPatch] {
        let plates = plan.plates.map { plate in
            AtlasFloorPatch(
                plate.rect,
                pigment: pigments.fog,
                weight: plateLight / (1 + Double(plate.depth) * plateFalloff),
            )
        }
        let floor = extent(of: plan.extent)
        let lattice = grid.map { lattice in
            AtlasFloorPatch(
                floor,
                pigment: pigments.fog,
                weight: lattice.weight,
                divisions: lattice.divisions,
            )
        }
        return plates + lattice
    }
}
