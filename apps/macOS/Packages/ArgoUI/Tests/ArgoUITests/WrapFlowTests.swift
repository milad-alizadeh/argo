@testable import ArgoUI
import SwiftUI
import Testing

/// Where the flow seats each item — the wrap arithmetic on its own, no layout pass and no view.
///
/// Most cases use the contract's shot size, because the gallery was the first caller and flows
/// only that; the mixed-size ones pin the rules the layout promises to its other caller, whose
/// items size themselves to their own text.
@Suite("Wrap flow")
struct WrapFlowTests {
    private static let tile = CGSize(width: 168, height: 112)
    private static let gap: CGFloat = 8

    @Test
    func `a run that fits stays on one line, one gap apart`() {
        let places = WrapFlow.placements(
            of: Array(repeating: Self.tile, count: 3), in: 600, gap: Self.gap,
        )
        #expect(places.map(\.minY) == [0, 0, 0])
        #expect(places.map(\.minX) == [0, 176, 352])
    }

    @Test
    func `the tile that would cross the measure starts the next line`() {
        // Three tiles and two gaps stand at 520; the fourth would end at 696, past 672.
        let places = WrapFlow.placements(
            of: Array(repeating: Self.tile, count: 4), in: 672, gap: Self.gap,
        )
        #expect(places[2].minY == 0)
        #expect(places[3].minX == 0)
        #expect(places[3].minY == Self.tile.height + Self.gap)
    }

    @Test
    func `a tile wider than the whole measure still gets a line`() {
        let wide = CGSize(width: 900, height: 100)
        let places = WrapFlow.placements(of: [wide, Self.tile], in: 672, gap: Self.gap)
        #expect(places[0].origin == .zero)
        #expect(places[1].minX == 0)
        #expect(places[1].minY == wide.height + Self.gap)
    }

    @Test
    func `the next line clears the tallest tile of the one before`() {
        let tall = CGSize(width: 168, height: 200)
        let places = WrapFlow.placements(
            of: [Self.tile, tall, Self.tile], in: 360, gap: Self.gap,
        )
        #expect(places[2].minY == tall.height + Self.gap)
    }

    @Test
    func `no tiles, no frames`() {
        #expect(WrapFlow.placements(of: [], in: 672, gap: Self.gap).isEmpty)
    }
}
