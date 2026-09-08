import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// THE MEASUREMENT #1600 asks for: a roof's colour against the legend swatch it is supposed to
/// match, over a real rendered frame rather than over the light model's own arithmetic.
///
/// **The prototype's 99.1 / 98.7 / 97.8 is not reproducible**: no harness that produced it was
/// ever committed. The method here is reconstructed from what the repository does say — the
/// population is the roof CENTRES ("picking is counted over hundreds of roof centres") and the
/// comparison is a HUE ("its bloom moved every band a hue off its legend"), both from the commit
/// that published the table.
///
/// A roof centre is used rather than a sweep of the frame because it is the only population that
/// isolates ROOFS: the id target names which file a pixel is and not which face of it, and a
/// file's roof centre is the one point of it that cannot be a wall.
///
/// What it therefore reds on: any term added to this shader that turns a hue, washes toward white,
/// or leaves a roof too dark to read a band off at all.
///
/// **What it measured when the floor, the grain and the sheen landed** (#1600): 69, 71 and 76
/// unoccluded roof centres for quiet, middling and hot, and 100.0% of each still read as its own
/// band. The worst single roof centre sat 0.078, 0.093 and 0.083 from its swatch in
/// `ArgoColor.distance(to:)`, against the 0.15 `ArgoLight.legendTolerance` allows.
///
/// A roof CENTRE sits half way along the sheen, so the brightest pixel of a roof is not in this
/// population at all. `AtlasLightingTests` bounds that one, where it is exact.
@Suite("Atlas — a roof is still its own band", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasRoofBandTests {
    static let pigments = AtlasPickingTests.pigments

    /// The fewest roof centres a band has to show for a share of them to mean anything. The
    /// crowded fixture below draws 208 files a band and towers hide most of them.
    static let leastMeasurable = 60

    @Test func `every roof the picture shows is still its own band`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = Self.crowded()
        let projection = AtlasProjection(of: plan, through: .city(over: plan.extent))
        let frame = try #require(await harness.frame(
            of: AtlasVolumes.city(of: plan, in: Self.pigments),
            plan: plan,
            through: projection.camera,
        ))

        var shown: [AtlasBand: Int] = [:]
        var kept: [AtlasBand: Int] = [:]
        var drift: [AtlasBand: Double] = [:]
        for tile in plan.tiles {
            guard let band = tile.band, let pixel = Self.roof(of: tile, in: projection),
                  harness.pick(at: pixel)?.file == tile.path
            else { continue }
            shown[band, default: 0] += 1
            let index = pixel.y * AtlasPickHarness.size.width + pixel.x
            if frame.band(atPixel: index) == band {
                kept[band, default: 0] += 1
            }
            let swatch = Self.pigments.pigment(of: band)
            let apart = Self.drawn(frame, atPixel: index).distance(to: swatch)
            drift[band] = max(drift[band] ?? 0, apart)
        }

        for band in [AtlasBand.quiet, .middling, .hot] {
            let seen = shown[band] ?? 0
            #expect(
                seen > Self.leastMeasurable,
                "\(band) drew too few unoccluded roofs to measure",
            )
            // The band the picture reads back as. This is the claim the light model owes: a
            // scalar multiply keeps a hue, so every roof centre is still its own band.
            #expect(
                kept[band] == seen,
                "\(band): \(kept[band] ?? 0) of \(seen) roof centres still read as their band",
            )
            // And how far from the swatch itself the worst of them reads, which is the stricter
            // question `ArgoLight.legendTolerance` is the stated bound on.
            #expect(
                (drift[band] ?? 1) < ArgoLight.legendTolerance,
                "\(band): worst of \(seen) roof centres reads \(drift[band] ?? 1) off its swatch",
            )
        }
    }

    /// One pixel of the frame as a colour again. BGRA, in the drawable's own order.
    private static func drawn(_ frame: AtlasFrame, atPixel index: Int) -> ArgoColor {
        ArgoColor(
            red: Double(frame.colour[index * 4 + 2]) / 255,
            green: Double(frame.colour[index * 4 + 1]) / 255,
            blue: Double(frame.colour[index * 4]) / 255,
        )
    }

    /// Where one file's roof centre lands in the frame, through the projection the frame was drawn
    /// with — `AtlasProjection.viewPoint`, which is the app's own, and the harness draws the plan
    /// into its own extent so a view point IS a pixel here.
    ///
    /// Nothing for a roof the frame does not reach, which a turned city has at its corners.
    private static func roof(of tile: AtlasTile, in projection: AtlasProjection) -> AtlasPixel? {
        let point = projection.viewPoint(x: tile.rect.midX, y: tile.rect.midY, height: tile.height)
        let pixel = AtlasPixel(x: Int(point.x), y: Int(point.y))
        let size = AtlasPickHarness.size
        guard pixel.x >= 0, pixel.y >= 0, pixel.x < size.width, pixel.y < size.height
        else { return nil }
        return pixel
    }

    /// Six hundred and twenty-five banded files on one plate, with a skyline: enough roofs for a
    /// percentage to mean something, and enough height for towers to cover their neighbours —
    /// which is what leaves the measurement over the roofs the picture actually SHOWS.
    static func crowded() -> AtlasPlan {
        let extent = CGSize(width: 200, height: 150)
        let bands: [AtlasBand] = [.quiet, .middling, .hot]
        let tiles = (0 ..< 25).flatMap { (row: Int) -> [AtlasTile] in
            (0 ..< 25).map { (column: Int) -> AtlasTile in
                AtlasTile(
                    path: "argo/plate/file-\(row)-\(column)",
                    rect: CGRect(x: CGFloat(column) * 8, y: CGFloat(row) * 6, width: 8, height: 6),
                    band: bands[(column + row * 2) % bands.count],
                    // A skyline, but INSIDE the ceiling a file of this plan may stand at
                    // (`AtlasElevation.ceiling`): towers past it hide three quarters of the roofs
                    // behind them and leave too few to measure.
                    height: CGFloat(2 + (column * 7 + row * 3) % 5 * 5),
                )
            }
        }
        return AtlasPlan(
            extent: extent,
            plates: [.init(
                path: "argo/plate",
                rect: CGRect(origin: .zero, size: extent),
                depth: 0,
            )],
            tiles: tiles,
        )
    }
}
