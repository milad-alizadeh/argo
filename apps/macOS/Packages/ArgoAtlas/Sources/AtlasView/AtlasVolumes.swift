import ArgoDesign
import AtlasLayout
import CoreGraphics

/// A plan, turned into the boxes the GPU draws (#1147, stood up at #1150).
///
/// Pure, and separated from the renderer for the reason the tiler is separated from the view: this
/// is where a file gets its colour and a folder its tone, and none of that needs a GPU to be
/// checked. `AtlasVolumesTests` is what checks it.
enum AtlasVolumes {
    /// The gap a file keeps around itself, so a treemap reads as rectangles rather than as one
    /// field of colour. It is the plate showing through rather than a stroke over the file, so it
    /// costs the map no second colour.
    ///
    /// HALF a hairline, because two files pay it: the SEAM between neighbours is what the token
    /// names, and each side gives up its share. A whole hairline each draws the seam at twice the
    /// weight the approved render does.
    static let gap = ArgoStroke.hairline / 2

    /// The border one plate is told from the next by, drawn as the plate's rim showing round its
    /// own ground rather than as a stroke over it — the same trick as `gap`, and for the same
    /// reason: a stroke would need a face nothing stands on.
    static let border = ArgoStroke.hairline

    /// Every box of the map, in the order they are painted.
    ///
    /// Plates first and outermost first, then the files, which is the painter's order: a nested
    /// plate covers the one it stands on and the files cover the plate they stand on. The plan
    /// already holds both lists that way, so nothing here re-sorts what the tiler decided.
    ///
    /// The order is not the whole story once the volumes stand up — a near tower has to cover a
    /// far plate whatever order the two were handed over in, and that is the depth buffer's job
    /// (`AtlasVolumeRenderer`). What the order still settles is everything COPLANAR: every plate
    /// and every roof at zero height is at one depth, and the later draw wins. That is what leaves
    /// the flat camera drawing exactly the treemap it drew before.
    ///
    /// A plate is TWO faces, rim then ground, so the border survives the nesting: a nested plate
    /// paints over its parent's ground, and without a rim of its own the seam between them is two
    /// tones that are equal once the contract's three have run out.
    /// A box's id is its place in `roster` plus one, so 0 is left meaning NOTHING — and every box
    /// drawn on this map carries one, because every box IS either a file or a folder's ground: a
    /// plate, its rim, and the shadow lying on it (#1153, #1156).
    static func city(of plan: AtlasPlan, in pigments: AtlasPigments) -> AtlasCity {
        AtlasCity(
            volumes: volumes(of: plan, in: pigments),
            roster: plan.plates.map { .folder($0.path) } + plan.tiles.map { .file($0.path) },
        )
    }

    private static func volumes(of plan: AtlasPlan, in pigments: AtlasPigments) -> [AtlasVolume] {
        // A folder is picked by its PLATE, which is the part of it no file stands on: the rim and
        // the margin the tiler leaves round its contents (#1156). Both faces carry the id, so the
        // rim between two neighbours names the folder whose rim it is — and a nested plate drawn
        // over its parent's ground takes the pixels it covers with it, which is what makes the
        // innermost folder at a point the one that answers.
        let plates = plan.plates.enumerated().flatMap { index, frame in
            [
                AtlasVolume(frame.rect, pigment: pigments.rim(at: frame.depth)),
                AtlasVolume(
                    frame.rect.shrunk(by: border),
                    pigment: pigments.plate(at: frame.depth),
                ),
            ].map { $0.identified(as: UInt32(index + 1)) }
        }
        // Cast between the plates and the tiles: after every plate, so a shadow always lands on
        // ground already drawn, and before every file, so a file standing where its own shadow
        // falls draws over it rather than under it (#1151).
        let ceiling = AtlasElevation.ceiling(of: plan.extent)
        //
        // A decal carries the id of the PLATE it lies on, not 0 (#1156). It is drawn after that
        // plate and coplanar with it, under a depth test that lets the later draw win, so an
        // unidentified decal writes 0 over the plate's own id — a hole in the folder's ground that
        // picks as nothing and is invisible at the flat camera, where the shader fades the decal
        // out but the tiler still places it. The decal is painted in the plate's own tone; it is
        // picked as the plate's own folder.
        let shadows = plan.tiles.compactMap { tile -> AtlasVolume? in
            guard let decal = AtlasShadow.decal(
                of: tile, on: plan.plates, ceiling: ceiling, in: pigments,
            ) else { return nil }
            let ground = AtlasShadow.plate(under: decal.rect, on: plan.plates)
            return ground.map { decal.identified(as: UInt32($0 + 1)) } ?? decal
        }
        // The id a file is picked by is its place in `plan.tiles` PLUS the plates in front of it
        // in the roster, plus one — so 0 is left meaning nothing, which on this map is the desktop
        // alone (#1153). Assigned in the same expression that paints the file, because the id
        // target and the screen are the same draw: an id handed out anywhere else would be a
        // second walk of the tiles, and a second walk is what a pick can drift against.
        let tiles = plan.tiles.enumerated().map { index, tile in
            AtlasVolume(
                tile.rect.shrunk(by: gap),
                roof: tile.height,
                pigment: pigments.pigment(of: tile),
            )
            .identified(as: UInt32(plan.plates.count + index + 1))
        }
        return plates + shadows + tiles
    }
}

private extension CGRect {
    /// Inset on every side, but never past nothing. `CGRect.insetBy` returns a NULL rectangle once
    /// the inset eats the whole width, and a null rectangle's origin is infinite — which reaches
    /// the GPU as a face covering the map. A real repository has files this small, so it is the
    /// common case rather than the corner.
    func shrunk(by edge: CGFloat) -> CGRect {
        CGRect(
            x: minX + min(edge, width / 2),
            y: minY + min(edge, height / 2),
            width: max(width - edge * 2, 0),
            height: max(height - edge * 2, 0),
        )
    }
}
