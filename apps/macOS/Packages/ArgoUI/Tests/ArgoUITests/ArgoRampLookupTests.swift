import ArgoDesign
@testable import ArgoUI
import Testing

/// The lookup the measure family exists for: a fraction of a repository's range in, a colour out.
/// A `LinearGradient` cannot be asked this, which is why `ArgoRamp` holds its stops (#1142).
@Suite("Ramp lookup — a fraction in, a colour out")
struct ArgoRampLookupTests {
    static let palettes = ArgoPalette.all

    /// Banding a measure is the whole job, so the three-band case is EXACT: every fraction in the
    /// range resolves to one of the three bands rather than to something between two of them,
    /// which would be a file drawn in a colour that is in no legend.
    @Test(arguments: palettes)
    func `every fraction of the measure ramp resolves to one of the three bands`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let measure = appearance.palette.atlas.measure
        let bands = Set(measure.all.map(\.color))
        for step in 0 ... 1000 {
            let fraction = Double(step) / 1000
            #expect(
                bands.contains(measure.ramp.color(at: fraction)),
                "\(fraction) landed between two bands",
            )
        }
    }

    /// Where each band gives way to the next: green is half the files, red is the top 15%. A
    /// fraction ON an edge belongs to the louder band — a file at the boundary is reported up,
    /// never down.
    @Test(arguments: palettes)
    func `the bands change hands at the halfway mark and at the top fifteen percent`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let measure = appearance.palette.atlas.measure
        #expect(measure.ramp.color(at: 0) == measure.quiet)
        #expect(measure.ramp.color(at: 0.499) == measure.quiet)
        #expect(measure.ramp.color(at: 0.5) == measure.middling)
        #expect(measure.ramp.color(at: 0.849) == measure.middling)
        #expect(measure.ramp.color(at: 0.85) == measure.hot)
        #expect(measure.ramp.color(at: 1) == measure.hot)
    }

    /// A measure arrives from arithmetic over a repository, so a fraction outside the range is a
    /// division that went somewhere: it clamps to an end rather than resolving to nothing.
    @Test(arguments: palettes)
    func `a fraction outside the range clamps to an end`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let measure = appearance.palette.atlas.measure
        #expect(measure.ramp.color(at: -1) == measure.quiet)
        #expect(measure.ramp.color(at: 2) == measure.hot)
    }

    /// The ion is not banded, and the same lookup says so: a stop resolves to itself, and a point
    /// between two stops resolves between them rather than snapping to either.
    @Test(arguments: palettes)
    func `the ion interpolates between its stops`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        #expect(palette.ion.color(at: 0.55) == palette.interaction.accent)
        let between = palette.ion.color(at: 0.655)
        let ends = [palette.interaction.accent, palette.interaction.accentBright]
        #expect(!ends.contains(between))
        #expect(between.distance(to: ends[0]) < ends[0].distance(to: ends[1]))
        #expect(between.distance(to: ends[1]) < ends[0].distance(to: ends[1]))
    }

    /// The pass and the lookup are two readings of one value, so they cannot disagree: the colour
    /// at a fraction is the colour the gradient draws there. `ArgoRampTests` holds the catalogue
    /// both of them are read off.
    @Test(arguments: palettes)
    func `the measure ramp's stops are its three bands, in order and doubled`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let measure = appearance.palette.atlas.measure
        let stops = measure.ramp.stops
        #expect(stops.map(\.color) == [
            measure.quiet, measure.quiet, measure.middling,
            measure.middling, measure.hot, measure.hot,
        ])
        #expect(stops.map(\.location) == [0, 0.5, 0.5, 0.85, 0.85, 1])
    }
}
