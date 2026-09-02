import ArgoDesign
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
    static let floor = ArgoPalette.TextRoles.contrastFloor

    /// D30's selection amendment reversed by #875: the one piece of state a reader tracks all day
    /// is where the identity has to be legible, so the ground under a selected row is the brand
    /// hue rather than a step off the neutral ramp.
    @Test(arguments: palettes)
    func `a selected row's ground is the brand hue, not a step off the neutral ramp`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ground = palette.interaction.selectionGround
        let neutral = palette.surface.selected.composited(over: palette.surface.base)
        #expect(ground.chromaticSpread > neutral.chromaticSpread * 3)
        // And it reads as SELECTED, not merely tinted. Each ground is measured against the
        // surface it is actually laid on — this one the rail, the wash it replaced the deck.
        #expect(ground.distance(to: palette.surface.sunken) >= neutral
            .distance(to: palette.surface.base))
    }

    /// #922: the platform still draws its capsule under this ground, so a translucent value is
    /// composited onto it and every reading below is taken against a ground the app never draws.
    @Test(arguments: palettes)
    func `the selected ground is opaque, so the platform's capsule cannot show through`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(appearance.palette.interaction.selectionGround.opacity == 1)
    }

    /// The value re-derived rather than trusted: a resolved hex nobody can reproduce is a number
    /// the next ground change edits by eye.
    @Test(arguments: palettes)
    func `the selected ground resolves the brand hue at 0.18 over the rail`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let resolved = palette.interaction.accent
            .opacity(0.18)
            .composited(over: palette.surface.sunken)
        // Within a rounding step: the palette holds the resolved value as a hex, and a hex
        // cannot spell the exact product of a 0.18 blend.
        #expect(palette.interaction.selectionGround.distance(to: resolved) < 1 / 255)
    }

    /// #922's own criterion: both of a row's readings of every voice clear one stated floor. This
    /// REPLACES #875's relative claim, which held each voice to what it read on the neutral wash —
    /// a claim that passed while the render sat at 2.49:1, because a ground the app never draws
    /// cannot fail it.
    @Test(arguments: palettes)
    func `every roster voice clears the ramp's floor on BOTH of a row's grounds`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        // `base` and not a rail token: an unselected row's ground is `.listStyle(.sidebar)`'s
        // own material, which no role names. `base` is the ground the whole ramp is already
        // measured on, and it is LIGHTER than the rail renders (`#1B1C1F`), so it bounds that
        // reading from the pessimistic side — 5.72:1 asserted against 5.97:1 measured.
        for ground in [palette.interaction.selectionGround, palette.surface.base] {
            for voice in [palette.text.primary, palette.text.secondary, palette.text.tertiary] {
                #expect(voice.contrastRatio(on: ground) >= Self.floor)
            }
        }
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
}
