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

    /// The deepest plate a point sits on — the one whose files it really belongs to, since a
    /// nested plate's rect sits wholly inside the one it folds into.
    private static func depth(at point: CGPoint, on plates: [AtlasPlateFrame]) -> Int {
        plates.filter { $0.rect.contains(point) }.map(\.depth).max() ?? 0
    }

    /// The decal, or nothing when the file is too short to bother. Pushed across the plan away
    /// from the key by a share of the file's own height — real sunlight at this pitch would throw
    /// a shadow longer than the plate it lands on and read as somebody else's, so the throw is
    /// compressed the same way for every file.
    static func decal(
        of tile: AtlasTile,
        on plates: [AtlasPlateFrame],
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

        let depth = depth(at: CGPoint(x: tile.rect.midX, y: tile.rect.midY), on: plates)
        let darkened = 1 - (1 - ArgoLight.shadowDepth) * weight
        return AtlasVolume(rect, shade: darkened, pigment: pigments.plate(at: depth))
    }
}
