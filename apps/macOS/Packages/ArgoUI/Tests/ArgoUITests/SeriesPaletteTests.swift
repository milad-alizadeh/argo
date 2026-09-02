import ArgoDesign
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

    /// `SeriesRoles` is not in `VisualContractCoverageTests`' reflected list and cannot be: the
    /// stored array is enumerated by place, so a hue cannot go missing from `all`. The WEIGHTED
    /// rungs are derived and no reflection reaches them at all, which is why `ramp(_:)` exists and
    /// why the specimen draws it by hand — see the ramp suite below.
    @Test(arguments: palettes)
    func `every series hue reaches the specimen through its own catalog`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let series = appearance.palette.series
        #expect(series.all.map(\.color) == series.hues)
        #expect(series.all.first?.name == "series1")
        // The rungs under each hue are a third catalog again, and the specimen draws THIS.
        #expect(series.ramp(0).map(\.color) == [
            series.hue(0, at: .spent), series.hue(0, at: .ordinary), series.hue(0, at: .full),
        ])
        #expect(series.ramp(0).first?.name == "series1 spent")
    }
}

/// The weighted rungs of a series hue — a Gantt's `done`, plain and `active` (#905).
///
/// Its own suite because the ramp is where this family knowingly stops meeting the two floors
/// above. Every claim here is the exemption written down: move a rung and one of these reds.
@Suite("Series ramp — one hue at three strengths")
struct SeriesRampTests {
    static let palettes = ArgoPalette.all
    private static let rungs = ArgoPalette.SeriesRoles.Weight.allCases

    /// The property the ramp exists for: three strengths of ONE hue, strictly ordered, so the
    /// three read as a scale rather than as a set. `full` is the hue itself — a plain Gantt bar
    /// and a pie slice are one mark, drawn identically.
    @Test(arguments: palettes)
    func `the rungs are one hue, strictly ordered, topped by the hue itself`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let series = appearance.palette.series
        let base = appearance.palette.surface.base
        for index in series.hues.indices {
            #expect(series.hue(index, at: .full) == series.hue(index))
            let drawn = Self.rungs.map { series.hue(index, at: $0).contrastRatio(on: base) }
            #expect(zip(drawn, drawn.dropFirst()).allSatisfy { $1 > $0 })
            // Stretched at the quiet end: the top step is the larger one, which is what keeps
            // `active` clear of a plain bar once a critical ring is drawing beside it.
            #expect(drawn[2] / drawn[1] > drawn[1] / drawn[0])
        }
    }

    /// The exemption, asserted at what it really achieves rather than waived.
    ///
    /// The 3:1 floor next door is for a mark whose own hue has to be identified across a feed. A
    /// dimmed bar's section comes from the heading over it, and being quiet is its whole message —
    /// but it still has to be a bar rather than a stain, so the floor it does clear is written
    /// down. There is no arrangement that clears 3:1: the run is 3.35:1 at full.
    @Test(arguments: palettes)
    func `the dimmed rungs clear the floor they are actually read at`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let series = appearance.palette.series
        let base = appearance.palette.surface.base
        for index in series.hues.indices {
            #expect(series.hue(index, at: .spent).contrastRatio(on: base) >= 1.6)
            #expect(series.hue(index, at: .ordinary).contrastRatio(on: base) >= 2.2)
        }
    }

    /// The separation rule bends here too, and by how much is the point.
    ///
    /// Dimming pulls a hue toward the ground, and this ground is a near-neutral — so every rung
    /// drifts toward `state.idle`, the one reserved hue that is itself a grey. `spent` comes out
    /// the far side and is clean; `ordinary` passes through the middle and is not. Asserted at the
    /// real number so a change that makes it worse reds rather than passing quietly.
    @Test(arguments: palettes)
    func `a dimmed rung is held off every hue that means something, as far as it can be`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let reserved = palette.state.all + palette.diff.all
            + [("accent", palette.interaction.accent)]
        for index in palette.series.hues.indices {
            let spent = palette.series.hue(index, at: .spent).composited(over: palette.surface.base)
            let mid = palette.series.hue(index, at: .ordinary)
                .composited(over: palette.surface.base)
            for status in reserved {
                #expect(spent.distance(to: status.color) > 0.25, "spent \(index) ≈ \(status.name)")
                #expect(mid.distance(to: status.color) > 0.13, "ordinary \(index) ≈ \(status.name)")
            }
        }
    }
}
