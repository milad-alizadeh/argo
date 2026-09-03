import ArgoDesign
@testable import ArgoUI
import Testing

/// What the ion claims about itself. A ramp is the one contract value a swatch cannot judge: the
/// stops read correctly in any order, and only the ORDER gives a pass its direction.
@Suite("The ion")
struct ArgoRampTests {
    static let palettes = ArgoPalette.all

    /// A ramp is derived from roles rather than stored beside them, so `Mirror` cannot reach it and
    /// the coverage guard over the colour groups never sees one. `ramps` is what stands in: the
    /// specimen draws that list, and every claim below runs over it rather than over `ion` by name.
    @Test(arguments: palettes)
    func `every ramp is in the catalog the specimen draws`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(appearance.palette.ramps.map(\.name) == ["ion", "measure"])
    }

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

    /// Both ends vanish, so a pass has a head and a tail instead of an edge.
    @Test(arguments: palettes)
    func `the ion is transparent at both ends`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let stops = appearance.palette.ion.stops
        #expect(stops.first?.color.opacity == 0)
        #expect(stops.last?.color.opacity == 0)
    }

    /// Between the ends the ion is at full strength. A stop that faded early would read as the pass
    /// running out of substance halfway across the line.
    @Test(arguments: palettes)
    func `every stop between the ends is opaque`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for stop in appearance.palette.ion.stops.dropFirst().dropLast() {
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

    /// The head sits short of the end, so the mint leads the pass OFF the line rather than landing
    /// on its last letter. Its distance from the end is what the ion fades out over.
    @Test(arguments: palettes)
    func `the head stops short of the end`(_ appearance: (name: String, palette: ArgoPalette)) {
        let head = appearance.palette.ion.stops.dropFirst().dropLast().last
        #expect(head?.color == appearance.palette.state.running)
        #expect((head?.location ?? 1) < 1)
    }
}
