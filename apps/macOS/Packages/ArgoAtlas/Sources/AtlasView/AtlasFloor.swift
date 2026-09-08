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
    /// The design draws it in a brighter cyan than the contract has, and the contract already
    /// names the floor's light — `fog`, "the floor's own light, which the contour grid takes" — so
    /// the pigment is `fog` and the weight is the one that lands the same LUMINANCE on the ground.
    /// `docs/designs/cockpit-atlas.md` carries the arithmetic for this and for the grid below.
    static let plateLight = 0.0589

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
    /// The fine weight is already `fog` in the page and is its own number; the coarse one is put
    /// back onto `fog` the way `plateLight` is.
    static let grid: [(divisions: Int, weight: Double)] = [(32, 0.10), (8, 0.185)]

    /// How far the floor runs: the plan, and `AtlasElevation.pad(of:)` past it.
    static func extent(of plan: CGSize) -> CGRect {
        let pad = AtlasElevation.pad(of: plan)
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
