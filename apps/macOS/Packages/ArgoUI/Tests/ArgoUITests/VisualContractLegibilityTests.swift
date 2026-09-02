import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// That every ink the contract ships can be READ on the ground it lands on: the text ramp on the
/// deck, a state ink spelled as a word rather than drawn as a dot, a whole row taken down by
/// ghosting, and text on an accent fill.
///
/// Which roles stay APART is `VisualContractTests`.
@Suite("Visual contract legibility")
struct VisualContractLegibilityTests {
    @Test(arguments: VisualContractFixture.palettes)
    func `text roles clear their contrast floor on the deck`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let base = appearance.palette.surface.base
        #expect(appearance.palette.text.primary.contrastRatio(on: base) >= 7)
        #expect(appearance.palette.text.secondary.contrastRatio(on: base) >= VisualContractFixture
            .floor)
        #expect(appearance.palette.text.tertiary.contrastRatio(on: base) >= VisualContractFixture
            .floor)
    }

    @Test(arguments: VisualContractFixture.palettes)
    func `every state ink and the accent stay legible as a word, not just as a dot`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let base = appearance.palette.surface.base
        let inks = (appearance.palette.state.all + appearance.palette.diff.all).map(\.color)
        for ink in inks + [appearance.palette.interaction.accent] {
            #expect(ink.contrastRatio(on: base) >= VisualContractFixture.floor)
        }
    }

    /// Ghosting a whole surface takes every ink on it down at once — the one device in the contract
    /// that can push a rung under its own floor. Held by a RELATIONSHIP rather than a second
    /// number: a ghosted row's ink stays at least as present as `disabled`.
    @Test(arguments: VisualContractFixture.palettes)
    func `a ghosted surface never falls below the ramp's own inert rung`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let base = appearance.palette.surface.base
        let floor = appearance.palette.text.disabled.contrastRatio(on: base)
        // The state inks are the LOUDEST thing a ghosted row takes down — an amber `Needs input`,
        // a red `Stopped`, a live dot — so they are in this loop too.
        let ghosted = [appearance.palette.text.primary, appearance.palette.text.tertiary]
            + appearance.palette.state.all.map(\.color)
        for ink in ghosted {
            #expect(ink.opacity(ArgoOpacity.ghosted).contrastRatio(on: base) >= floor)
        }
    }

    @Test(arguments: VisualContractFixture.palettes)
    func `text on an accent fill is legible`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(
            appearance.palette.text.onAccent
                .contrastRatio(on: appearance.palette.interaction.accent) >= VisualContractFixture
                .floor,
        )
    }
}
