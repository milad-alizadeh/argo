@testable import ArgoUI
import Testing

/// The one family of hues this palette spends on a KIND. Every claim is parameterised over
/// `ArgoPalette.all`, so a light appearance inherits all of them the day it is added.
@Suite("Series palette — categorical hues that collide with nothing")
struct SeriesPaletteTests {
    static let palettes = ArgoPalette.all

    /// A slice is read beside the slice next to it AND beside everything else in the feed. It owes
    /// them the distance the four operational states owe each other: a wedge that lands on the
    /// amber this app means `attention` with reads as a warning, and one that lands on
    /// `diff.removed` reads as a deleted line in a patch three rows up.
    ///
    /// `interaction.destructive` is not here on purpose — it is a ground under a swiped roster
    /// row rather than an ink in the feed, so a wedge is never read beside it.
    @Test(arguments: palettes)
    func `a series hue is held off every hue that means something`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let reserved = appearance.palette.state.all + appearance.palette.diff.all
            + [("accent", appearance.palette.interaction.accent)]
        for (at, hue) in appearance.palette.series.hues.enumerated() {
            for status in reserved {
                #expect(
                    hue.distance(to: status.color) > 0.25,
                    "series\(at + 1) resolves next door to \(status.name)",
                )
            }
        }
    }

    @Test(arguments: palettes)
    func `no two series are near-neighbours a glance would fuse`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let hues = appearance.palette.series.hues
        for (at, hue) in hues.enumerated() {
            for other in hues.indices where other > at {
                #expect(
                    hue.distance(to: hues[other]) > 0.25,
                    "series\(at + 1) ≈ series\(other + 1)",
                )
            }
        }
    }

    /// Longer than any chart written in a message needs, and the entry past the end wraps to the
    /// first rather than running out or clamping every overflow onto one colour.
    @Test(arguments: palettes)
    func `the run is longer than a chart needs and wraps past its end`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let series = appearance.palette.series
        #expect(series.hues.count >= 8)
        #expect(series.hue(0) == series.hues.first)
        #expect(series.hue(series.hues.count) == series.hues.first)
        #expect(series.hue(series.hues.count + 2) == series.hues[2])
        #expect(series.hue(-1) == series.hues.last)
    }

    /// A wedge is a large mark rather than a word, so 3:1 on the deck it is drawn on is the floor
    /// it is read at.
    @Test(arguments: palettes)
    func `every series hue is visible on the deck it is drawn on`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for hue in appearance.palette.series.hues {
            #expect(hue.contrastRatio(on: appearance.palette.surface.base) >= 3)
        }
    }

    /// `SeriesRoles` is not in `VisualContractCoverageTests`' reflected list and cannot be: its
    /// storage IS its catalog, one array enumerated by place, so a hue cannot go missing from
    /// `all`. What it owes instead is that the array is not empty — a group nothing enumerates
    /// draws nothing in the specimen.
    @Test(arguments: palettes)
    func `every series hue reaches the specimen through its own catalog`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let series = appearance.palette.series
        #expect(series.all.map(\.color) == series.hues)
        #expect(series.all.first?.name == "series1")
    }
}
