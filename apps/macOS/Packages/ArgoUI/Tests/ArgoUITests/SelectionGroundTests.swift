@testable import ArgoUI
import Testing

/// Where the identity is SPENT, which #875 changed: the ground under a selected roster row, and
/// the weight that ground is allowed to carry.
///
/// Its own suite rather than a section of `VisualContractTests`: those are claims about the
/// contract's internal relationships, and these are claims about one decision — D30's selection
/// amendment, reversed.
@Suite("Selection ground")
struct SelectionGroundTests {
    static let palettes = ArgoPalette.all

    /// D30's selection amendment reversed by #875: the one piece of state a reader tracks all day
    /// is where the identity has to be legible, so the ground under a selected row is the brand
    /// hue rather than a step off the neutral ramp.
    @Test(arguments: palettes)
    func `a selected row's ground is the brand hue, not a step off the neutral ramp`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ground = palette.interaction.selectionGround.composited(over: palette.surface.base)
        let neutral = palette.surface.selected.composited(over: palette.surface.base)
        #expect(ground.chromaticSpread > neutral.chromaticSpread * 3)
        // And it reads as SELECTED, not merely as tinted: at least the separation the neutral wash
        // it replaces had.
        #expect(ground.distance(to: palette.surface.base) >= neutral
            .distance(to: palette.surface.base))
    }

    /// The weight is the whole argument for `selectionGround` being a wash rather than the accent
    /// at strength: a saturated Ion Blue row cannot carry this app's own inks. Measured against the
    /// wash it replaces, because that is the legibility the roster already had.
    @Test(arguments: palettes)
    func `every roster voice reads at least as well on the accent ground as on the neutral wash`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ground = palette.interaction.selectionGround.composited(over: palette.surface.base)
        let neutral = palette.surface.selected.composited(over: palette.surface.base)
        for voice in [palette.text.primary, palette.text.secondary, palette.text.tertiary] {
            #expect(voice.contrastRatio(on: ground) >= voice.contrastRatio(on: neutral))
        }
    }

    /// "Argo's own Ion Blue, not the system accent" is only worth saying if the value holds where
    /// it is spent, and it is spent at both weights: as an INK at full strength on the deck, and
    /// as the GROUND under a row. Both are asserted, because the amended rule names both.
    @Test(arguments: palettes)
    func `the brand hue holds against the graphite ground at AA, at either weight`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ground = palette.interaction.selectionGround.composited(over: palette.surface.base)
        #expect(palette.interaction.accent.contrastRatio(on: palette.surface.base) >= 4.5)
        // The row's own two loudest voices, absolutely rather than only against the old wash —
        // `text.tertiary` is exempt for the reason it is exempt on `surface.selected`, which it
        // already fell under: the contract measures every ink against `base`.
        #expect(palette.text.primary.contrastRatio(on: ground) >= 4.5)
        #expect(palette.text.secondary.contrastRatio(on: ground) >= 4.5)
    }

    /// The role the accent ground REPLACED on the roster is still neutral, and still has to be:
    /// it is what a pressed, open or current control carries, and D30's argument against a brand
    /// hue there never moved. The claim survived #875; only its subject changed.
    @Test(arguments: palettes)
    func `the pressed-and-current wash stays neutral`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        #expect(palette.surface.selected.composited(over: palette.surface.base)
            .chromaticSpread <= 0.05)
    }

    /// One mechanism, both sidebars (#906): the roster and the Work room's view list each ask the
    /// same function for a row's ground, so a selection cannot read as brand in one rail and as the
    /// platform's fixed neutral in the other.
    @Test(arguments: palettes)
    func `a selected sidebar row takes the brand wash, whichever sidebar it is in`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let selected = ArgoSelectedRowGround.ground(isSelected: true, in: palette)
        #expect(selected.composited(over: palette.surface.base)
            .chromaticSpread > palette.surface.selected.composited(over: palette.surface.base)
            .chromaticSpread * 3)
    }

    /// And nothing at all under the others: the sidebar's own system material is the surface D3
    /// reserves for an unselected row, so the ground may not lay a step of the ramp over it.
    @Test(arguments: palettes)
    func `an unselected sidebar row draws no ground of its own`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let ground = ArgoSelectedRowGround.ground(isSelected: false, in: appearance.palette)
        #expect(ground.opacity == 0)
    }
}
