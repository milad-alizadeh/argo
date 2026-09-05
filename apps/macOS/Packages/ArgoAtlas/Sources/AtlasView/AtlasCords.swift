import ArgoDesign
import AtlasLayout
import CoreGraphics

/// Every cord on one frame of the map: which ties are drawn, where each runs, and how brightly
/// (#1160).
///
/// Apart from the view that strokes them, and not a `View`'s own method, for the reason the tiler
/// is apart from the surface: this is where the reader's two questions become a picture — the
/// strongest across the whole map, and what the pinned file changes with — and none of it needs a
/// `Canvas` to be checked. `AtlasTieCordTests` is what checks it.
struct AtlasCords: Equatable {
    /// The cords, in the order they are stroked: the map's own first, so the pinned file's lie
    /// over them.
    let cords: [Cord]

    /// One tie, chosen and placed: what it is, where it runs, and at which of the two weights.
    struct Cord: Equatable {
        let coupling: AtlasCoupling
        let cord: AtlasCord
        let weight: AtlasCordWeight

        /// The share of the cord's material this one is drawn at: the weight's share, spent
        /// through the tie's own strength — the strongest tie in the repository must not be drawn
        /// as the hundred and sixtieth is. The two numbers are the approved render's own
        /// (`docs/designs/cockpit-atlas.html`, `filaments`).
        var alpha: Double {
            weight.alpha * (0.3 + coupling.strength * 0.62)
        }

        /// What it is stroked at, widened by the same strength and by the render's own numbers.
        var width: CGFloat {
            weight.width * (0.55 + coupling.strength)
        }
    }

    /// **One pair, one cord**, across the two readings as well as within either: a tie the pinned
    /// file owns is dropped from the whole-map set rather than stroked twice, and the reading that
    /// survives is the one the reader just asked for.
    ///
    /// With the switch off and nothing pinned this is empty, which is the whole of "turning ties
    /// off leaves no trace on the frame": a `Canvas` handed nothing strokes nothing.
    init(of ties: AtlasTies, pinned: String?, through projection: AtlasProjection) {
        let own = pinned.map { ties.couplings.ties(of: $0) } ?? []
        let pinnedPairs = Set(own.map(\.pair))
        let across = ties.isOn
            ? ties.couplings.strongest().filter { !pinnedPairs.contains($0.pair) }
            : []
        let seats = AtlasCords.seats(of: projection)
        func place(_ couplings: [AtlasCoupling], _ weight: AtlasCordWeight) -> [Cord] {
            couplings.compactMap {
                AtlasCords.cord(of: $0, weight, among: seats, through: projection)
            }
        }
        self.cords = place(across, .acrossTheMap) + place(own, .ofThePinnedFile)
    }

    /// One tie placed on the map, or nothing where it cannot be: a tie to a file the map is not
    /// drawing has no box to end on — the case a filter makes — and two roofs that project onto
    /// nearly one point have no line between them to read.
    private static func cord(
        of coupling: AtlasCoupling,
        _ weight: AtlasCordWeight,
        among seats: [String: AtlasTile],
        through projection: AtlasProjection,
    )
        -> Cord? {
        guard let first = seats[coupling.first], let second = seats[coupling.second],
              let cord = AtlasCord(
                  between: first,
                  and: second,
                  through: projection,
                  strength: coupling.strength,
              )
        else {
            return nil
        }
        return Cord(coupling: coupling, cord: cord, weight: weight)
    }

    /// Every drawn file by path, at the height it is STANDING this frame — its measured height
    /// once the rise has settled, and a share of it while the city is still coming up (#1421).
    /// Solved off the same projection the surface was handed, so a cord cannot leave a roof the
    /// box has not climbed to yet.
    ///
    /// A dictionary rather than a search per end: a hundred and sixty ties over 2,705 files is
    /// 320 linear walks of the plan on every frame.
    private static func seats(of projection: AtlasProjection) -> [String: AtlasTile] {
        let rise = AtlasRise(projection)
        let centre = projection.camera.centre
        return projection.plan.tiles.reduce(into: [:]) { seats, tile in
            seats[tile.path] = AtlasTile(
                path: tile.path,
                rect: tile.rect,
                band: tile.band,
                height: rise.height(of: tile, about: centre),
            )
        }
    }
}
