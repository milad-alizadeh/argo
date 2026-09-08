import ArgoDesign
import AtlasLayout
import CoreGraphics

/// The shadow a raised file throws across its own plate (#1151).
///
/// A statement about height rather than a second light: it is a flat decal, baked once with the
/// tiling rather than solved per frame, and it fades out with `relief` in `AtlasVolume.metal` the
/// same way the directional light does — the treemap shows no heights, so it casts none.
enum AtlasShadow {
    /// How far a file has to clear before it casts anything, and how far past that it takes to
    /// reach full strength — both a SHARE of the same ceiling `AtlasElevation` scales heights by,
    /// so the throw means the same thing on a small window as a large one.
    private static func weight(of height: CGFloat, ceiling: CGFloat) -> CGFloat {
        guard ceiling > 0 else { return 0 }
        let share = height / ceiling
        let floor = ArgoLight.shadowFloorShare
        let span = ArgoLight.shadowFullShare - floor
        guard span > 0 else { return 0 }
        return min(1, max(0, (share - floor) / span))
    }

    /// The decal, or nothing when the file is too short to bother. Pushed across the plan away
    /// from the key by a share of the file's own height — real sunlight at this pitch would throw
    /// a shadow longer than the plate it lands on and read as somebody else's, so the throw is
    /// compressed the same way for every file.
    ///
    /// It comes back already carrying the id of the plate it lies on (#1156). One lookup rather
    /// than two — the tone and the id are the same plate by construction here, where a caller
    /// asking twice was two chances to name different ones (#1598).
    static func decal(
        of tile: AtlasTile,
        on plates: AtlasPlateIndex,
        ceiling: CGFloat,
        in pigments: AtlasPigments,
    )
        -> AtlasVolume? {
        let weight = weight(of: tile.height, ceiling: ceiling)
        guard weight > 0 else { return nil }

        let key = ArgoLight.key.direction
        let planar = (key.x * key.x + key.y * key.y).squareRoot()
        guard planar > 0 else { return nil }
        let throwLength = tile.height * ArgoLight.shadowSlope
        let offset = CGPoint(
            x: -CGFloat(key.x / planar) * throwLength,
            y: -CGFloat(key.y / planar) * throwLength,
        )
        let rect = tile.rect.offsetBy(dx: offset.x, dy: offset.y)

        // A decal carries the id of the PLATE it lies on, not 0 (#1156). It is drawn after that
        // plate and coplanar with it, under a depth test that lets the later draw win, so an
        // unidentified decal writes 0 over the plate's own id — a hole in the folder's ground that
        // picks as nothing and is invisible at the flat camera, where the shader fades the decal
        // out but the tiler still places it. It is painted in the plate's own tone; it is picked
        // as the plate's own folder. Nothing under it at all is the desktop, which names nothing.
        let ground = plates.plate(under: rect)
        let depth = ground.map(plates.depth(of:)) ?? 0
        let darkened = 1 - (1 - ArgoLight.shadowDepth) * weight
        let decal = AtlasVolume(rect, shade: darkened, pigment: pigments.plate(at: depth))
        return ground.map { decal.identified(as: UInt32($0 + 1)) } ?? decal
    }
}
