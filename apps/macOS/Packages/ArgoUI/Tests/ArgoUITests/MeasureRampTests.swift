import ArgoDesign
@testable import ArgoUI
import Testing

/// The measure ramp is a TRAFFIC LIGHT, and it knowingly sits inside the 0.25 the rest of this
/// contract holds between a hue and an operational state.
///
/// Its own suite for the reason `SeriesRampTests` has one: this is where an exemption is written
/// down. Every band's distance from the state it sits near is asserted at the number it really is,
/// so moving a band reds here rather than passing quietly (#1142).
@Suite("Measure ramp — a traffic light, and the exemption it takes")
struct MeasureRampTests {
    static let palettes = ArgoPalette.all

    /// The three pairs the exemption is FOR, each measured. What licenses them is that no state
    /// role is ever drawn on the map: a band and a status chip are never in one field of view, and
    /// amber meaning the same thing on a roof as on a chip is the reading being bought.
    @Test(arguments: palettes)
    func `each band's distance from the state it sits near is the number it is`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let stated = [
            Pair(palette.atlas.measure.quiet, palette.state.idle, apart: 0.169),
            Pair(palette.atlas.measure.middling, palette.state.attention, apart: 0.212),
            Pair(palette.atlas.measure.hot, palette.state.failure, apart: 0.203),
        ]
        for claim in stated {
            #expect(abs(claim.band.distance(to: claim.state) - claim.apart) < 0.001)
        }
    }

    /// One band, the state it sits near, and how far apart they really are.
    private struct Pair {
        let band: ArgoColor
        let state: ArgoColor
        let apart: Double

        init(_ band: ArgoColor, _ state: ArgoColor, apart: Double) {
            self.band = band
            self.state = state
            self.apart = apart
        }
    }

    /// The exemption is exactly three pairs wide. Every OTHER band-and-state pair keeps the full
    /// distance, so a band never lands on a state it was not measured against.
    @Test(arguments: palettes)
    func `the exemption covers three pairs and no others`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let near: Set<[String]> = [["quiet", "idle"], ["middling", "attention"], ["hot", "failure"]]
        for band in palette.atlas.measure.all {
            for status in palette.state.all where !near.contains([band.name, status.name]) {
                #expect(
                    band.color.distance(to: status.color) > 0.25,
                    "measure.\(band.name) resolves next door to state.\(status.name)",
                )
            }
        }
    }

    /// And nothing else is exempt: the bands keep the full distance from both diff inks and from
    /// Ion Blue, which a map's legend is read inches from.
    @Test(arguments: palettes)
    func `the bands are held off the diff inks and the brand at full distance`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let reserved = palette.diff.all + [("accent", palette.interaction.accent)]
        for band in palette.atlas.measure.all {
            for role in reserved {
                #expect(
                    band.color.distance(to: role.color) > 0.25,
                    "measure.\(band.name) resolves next door to \(role.name)",
                )
            }
        }
    }

    /// Green, amber, red — and the ordering channel is the HUE. Luminance is deliberately not
    /// monotone across the three: an amber that had to be lighter than the green and darker than
    /// the red would not be the amber a reader already owns.
    @Test(arguments: palettes)
    func `the bands are a traffic light, ordered by hue and not by luminance`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let measure = appearance.palette.atlas.measure
        #expect(measure.quiet.green > measure.quiet.red)
        #expect(measure.hot.red > measure.hot.green)
        #expect(measure.middling.red > measure.middling.blue)
        #expect(measure.middling.green > measure.middling.blue)
        let luminance = measure.all.map(\.color.relativeLuminance)
        #expect(!zip(luminance, luminance.dropFirst()).allSatisfy { $1 > $0 })
        #expect(!zip(luminance, luminance.dropFirst()).allSatisfy { $1 < $0 })
    }

    /// A band is a large mark on a plate rather than a word, so 3:1 on every plate it can be drawn
    /// on is the floor it is read at — the same floor a series hue clears on the deck.
    @Test(arguments: palettes)
    func `every band is visible on every plate it is drawn on`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        for band in palette.atlas.measure.all {
            for plate in palette.atlas.materials.plates {
                #expect(band.color.contrastRatio(on: plate.color) >= 3)
            }
        }
    }
}
