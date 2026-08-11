@testable import ArgoUI
import Testing

/// What the ion claims about itself. A ramp is the one contract value a swatch cannot judge: the
/// stops read correctly in any order, and only the ORDER gives a pass its direction.
@Suite("The ion")
struct ArgoRampTests {
    static let palettes = ArgoPalette.all

    /// A gradient whose stops are out of order draws bands rather than a pass, and SwiftUI does not
    /// complain about it.
    @Test(arguments: palettes)
    func `the stops run in order from one end to the other`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let locations = appearance.palette.ion.stops.map(\.location)
        #expect(locations == locations.sorted())
        #expect(locations.first == 0)
        #expect(locations.last == 1)
    }

    /// Both ends vanish, so a pass has a head and a tail instead of an edge. They fade through the
    /// role BESIDE them rather than through a clear black, which SwiftUI would interpolate as grey.
    @Test(arguments: palettes)
    func `the ion is transparent at both ends and opaque in between`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let stops = appearance.palette.ion.stops
        #expect(stops.first?.color.opacity == 0)
        #expect(stops.last?.color.opacity == 0)
        for stop in stops.dropFirst().dropLast() {
            #expect(stop.color.opacity == 1)
        }
    }

    /// Deep tail into a mint head: the direction is what says where the work is, and it is carried
    /// by the order of existing roles rather than by a new hue.
    @Test(arguments: palettes)
    func `the ion runs the brand into the running state`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let inks = palette.ion.stops.dropFirst().dropLast().map(\.color)
        #expect(inks == [
            palette.interaction.accentDeep,
            palette.interaction.accent,
            palette.interaction.accentBright,
            palette.state.running,
        ])
    }

    /// The head sits short of the end, so the mint leads the pass off the line rather than landing
    /// on its last letter.
    @Test(arguments: palettes)
    func `the head leads the tail`(_ appearance: (name: String, palette: ArgoPalette)) {
        let stops = appearance.palette.ion.stops
        let head = stops.first { $0.color == appearance.palette.state.running }
        #expect(head?.location == 0.88)
    }
}
