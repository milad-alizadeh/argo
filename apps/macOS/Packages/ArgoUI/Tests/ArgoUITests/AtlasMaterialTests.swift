import ArgoDesign
@testable import ArgoUI
import Testing

/// The materials the map itself is made of — the ground, the three plates, the floor's light and
/// the two greys a domain can resolve to (#1142).
///
/// Parameterised over `ArgoPalette.all`, the way the rest of the contract's colour claims are, so
/// a second appearance inherits every one of them the day it is added.
@Suite("Atlas materials — the place the map is drawn on")
struct AtlasMaterialTests {
    static let palettes = ArgoPalette.all

    /// The map's own materials owe the four operational states the distance every other hue in
    /// this contract owes them. Only the measure ramp is exempt, and `MeasureRampTests` states
    /// that exemption as three measured numbers rather than as a silence.
    ///
    /// Over `grounds` rather than `all`: `inferred` is an INK, it is `text.tertiary`, and this
    /// contract has never held the neutral text ramp off a state — a grey word beside a grey dot
    /// is read as a word.
    @Test(arguments: palettes)
    func `every map ground is held off all four operational states`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        for material in palette.atlas.materials.grounds {
            for status in palette.state.all {
                #expect(
                    material.color.distance(to: status.color) > 0.25,
                    "atlas.\(material.name) resolves next door to state.\(status.name)",
                )
            }
        }
    }

    /// A plate is lit ground, and the three tones are one per depth of nesting — so they darken in
    /// that order, and all three sit above the desktop the map is drawn on. Depth is the ORDER: a
    /// ramp out of order is a map whose nesting reads inside out.
    @Test(arguments: palettes)
    func `the plates darken with depth and all of them sit above the desktop`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let materials = appearance.palette.atlas.materials
        let plates = materials.plates.map(\.color.relativeLuminance)
        #expect(zip(plates, plates.dropFirst()).allSatisfy { $1 < $0 })
        #expect(plates.allSatisfy { $0 > materials.desktop.relativeLuminance })
    }

    /// The floor's own light, which the contour grid takes: cool, because the fill lamp is.
    @Test(arguments: palettes)
    func `the fog is the cool end of the map`(_ appearance: (name: String, palette: ArgoPalette)) {
        let fog = appearance.palette.atlas.materials.fog
        #expect(fog.blue > fog.green)
        #expect(fog.green > fog.red)
    }

    /// A domain nothing can be told about, and a domain that is not the one being looked at, are
    /// two different readings — so they are two roles, they are told apart, and the hushed one is
    /// the quieter.
    @Test(arguments: palettes)
    func `unassigned and hushed are told apart, and hushed is the quieter`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let materials = appearance.palette.atlas.materials
        #expect(materials.unassigned.distance(to: materials.hushed) > 0.25)
        #expect(materials.hushed.relativeLuminance < materials.unassigned.relativeLuminance)
    }

    /// A domain is INFERRED, and the contract had no vocabulary for the third honesty tier. The
    /// ink is not a new colour: it IS the quietest voice, and this is the claim that holds the two
    /// together — a value drifting off `text.tertiary` would be a second grey nobody decided on.
    @Test(arguments: palettes)
    func `the inferred ink is the text ramp's own quietest voice`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(appearance.palette.atlas.materials.inferred == appearance.palette.text.tertiary)
    }

    /// The ink's own distance from the states, measured rather than left out.
    ///
    /// It is the ONE promoted colour that does not clear 0.25: it sits 0.079 from `state.idle`,
    /// because both are the same neutral grey and it is `text.tertiary`, which this contract has
    /// never held off a state — every rung of the text ramp would fail that rule. What it buys is
    /// that the number is in a test: an `inferred` that stops being `text.tertiary` and drifts
    /// toward a state reds here rather than passing on the strength of a doc comment.
    @Test(arguments: palettes)
    func `the inferred ink's own distance from the states is stated, not skipped`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let inferred = palette.atlas.materials.inferred
        #expect(abs(inferred.distance(to: palette.state.idle) - 0.079) < 0.001)
        for status in palette.state.all where status.name != "idle" {
            #expect(inferred.distance(to: status.color) > 0.25)
        }
    }
}
