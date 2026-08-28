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

    /// "Argo's own Ion Blue, not the system accent" is only worth saying if the value holds on the
    /// ground it is spent on — the accent is drawn AS AN INK at full strength on the deck.
    @Test(arguments: palettes)
    func `the brand hue holds against the graphite ground at AA`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        #expect(palette.interaction.accent.contrastRatio(on: palette.surface.base) >= 4.5)
    }
}
