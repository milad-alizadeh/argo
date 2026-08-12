@testable import ArgoUI
import Foundation
import Testing

/// Which slice of the miniature the lane holds as pixels. The claim under all of it is the memory
/// bound: a band is chosen from the lane's own height, never from the session's, so a session ten
/// times longer costs the same bitmap.
@Suite("Minimap band")
struct MinimapBandTests {
    private static let reach: CGFloat = 1800

    @Test
    func `the band is centred on what the lane is showing`() {
        let band = MinimapBand.around(1000 ... 1600, of: 9000, reach: Self.reach)
        #expect(band.origin == 400)
        #expect(band.height == 1800)
    }

    @Test
    func `a band at the head of the miniature does not run off it`() {
        #expect(MinimapBand.around(0 ... 600, of: 9000, reach: Self.reach).origin == 0)
    }

    @Test
    func `a band at the foot of the miniature does not run off it`() {
        let band = MinimapBand.around(8400 ... 9000, of: 9000, reach: Self.reach)
        #expect(band.origin == 7200)
        #expect(band.range.upperBound == 9000)
    }

    @Test
    func `a miniature shorter than the reach is held whole`() {
        let band = MinimapBand.around(0 ... 600, of: 900, reach: Self.reach)
        #expect(band.origin == 0)
        #expect(band.height == 900)
    }

    @Test
    func `the band holds a lane-height of slack in either direction`() {
        let band = MinimapBand.around(1000 ... 1600, of: 9000, reach: Self.reach)
        #expect(band.covers(1000 ... 1600))
        #expect(band.covers(400 ... 1000))
        #expect(band.covers(1600 ... 2200))
        #expect(band.covers(399 ... 999) == false)
        #expect(band.covers(1601 ... 2201) == false)
    }
}
