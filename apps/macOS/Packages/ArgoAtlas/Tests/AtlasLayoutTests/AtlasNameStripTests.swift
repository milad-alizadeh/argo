import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// Where a folder's name goes. The strip is the tiler's own arithmetic — it is the room the plate
/// spent on being readable as a folder, and it shrinks with the plate — so whatever draws the name
/// reads it off the frame rather than deriving it again and landing a name across a file.
@Suite("Atlas — a plate's name strip")
struct AtlasNameStripTests {
    @Test func `the strip is the room the plate kept above what stands on it`() throws {
        let plan = try AtlasPlan(
            tiling: AtlasMapFixture.argo(),
            by: AtlasChannels("lines"),
            into: CGSize(width: 1200, height: 800),
        )

        for plate in plan.plates {
            let strip = plate.nameStrip
            #expect(plate.rect.contains(strip), "\(plate.path)")
            for tile in plan.tiles where plate.rect.contains(tile.rect) {
                #expect(!strip.intersects(tile.rect), "\(tile.path) is under \(plate.path)'s name")
            }
        }
    }

    /// A plate too small to spare the room gets a shorter strip rather than eating its children's
    /// ground — the same clamp `AtlasFraming.frameShare` holds the interior with.
    @Test func `a plate smaller than its own frame keeps a shorter strip`() {
        let roomy = AtlasPlateFrame(
            path: "a", rect: CGRect(x: 0, y: 0, width: 200, height: 200), depth: 0,
        )
        let cramped = AtlasPlateFrame(
            path: "b", rect: CGRect(x: 0, y: 0, width: 8, height: 8), depth: 3,
        )

        #expect(roomy.nameStrip.height == AtlasFraming.plateHeader)
        #expect(cramped.nameStrip.height < AtlasFraming.plateHeader)
        #expect(cramped.nameStrip.height > 0)
    }
}
