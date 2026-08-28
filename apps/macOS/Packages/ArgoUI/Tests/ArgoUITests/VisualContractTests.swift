@testable import ArgoUI
import Testing

/// The claims the contract makes about itself — rules a colour tweak could break silently.
///
/// Every colour claim is parameterised over `ArgoPalette.all` rather than written against
/// `graphite`, so a light appearance arrives already governed: the rules are about RELATIONSHIPS
/// between roles — separation, ordering, contrast — not about absolute values.
@Suite("Visual contract")
struct VisualContractTests {
    static let palettes = ArgoPalette.all
    let palette = ArgoPalette.graphite

    // MARK: - The neutral ramp

    @Test(arguments: palettes)
    func `the neutral ramp is grey, not navy`(_ appearance: (name: String, palette: ArgoPalette)) {
        for surface in appearance.palette.surface.ramp {
            #expect(surface.chromaticSpread <= 0.05)
            #expect(abs(surface.blue - surface.red) <= 0.05)
        }
    }

    @Test
    func `the neutral ramp is near-black at its base`() {
        #expect(palette.surface.base.relativeLuminance < 0.02)
        #expect(palette.surface.sunken.relativeLuminance < palette.surface.base.relativeLuminance)
    }

    /// Ordered by depth, not by brightness: a light appearance runs the other way, so the claim is
    /// only that consecutive steps are DISTINCT and monotonic.
    @Test(arguments: palettes)
    func `the ramp steps monotonically, so depth reads off tone alone`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let luminances = appearance.palette.surface.ramp.map(\.relativeLuminance)
        #expect(luminances == luminances.sorted() || luminances == luminances.sorted().reversed())
        #expect(Set(luminances).count == luminances.count)
    }

    // MARK: - Ion Blue is brand, never status

    @Test(arguments: palettes)
    func `no operational state resolves anywhere near the brand hue`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for state in appearance.palette.state.all {
            #expect(state.color.distance(to: appearance.palette.interaction.accent) > 0.25)
        }
    }

    @Test
    func `selection and focus are the brand hue`() {
        #expect(palette.interaction.selectionIndicator == palette.interaction.accent)
        #expect(palette.interaction.focusRing == palette.interaction.accentBright)
    }

    @Test(arguments: palettes)
    func `the destructive ground is neither the brand nor the failure ink`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let destructive = appearance.palette.interaction.destructive
        #expect(destructive.distance(to: appearance.palette.interaction.accent) > 0.25)
        // Inches apart on one swiped roster row, and two different claims — see `DiffRoles`.
        #expect(destructive.distance(to: appearance.palette.state.failure) > 0.25)
        // The mark on it is the row's own brightest ink, not the near-black Ion Blue takes.
        #expect(appearance.palette.text.primary.contrastRatio(on: destructive) >= 4.5)
    }

    @Test(arguments: palettes)
    func `no two operational states are near-neighbours`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let states = appearance.palette.state.all
        for (index, state) in states.enumerated() {
            for other in states[(index + 1)...] {
                #expect(state.color.distance(to: other.color) > 0.25)
            }
        }
    }

    @Test(arguments: palettes)
    func `idle is a neutral slate — finished work recedes, it does not celebrate`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(appearance.palette.state.idle.chromaticSpread <= 0.08)
    }

    // MARK: - The diff inks are their own roles

    /// The two sit inches apart in one feed: `+8` next to a live Session's dot may not be the same
    /// green.
    @Test(arguments: palettes)
    func `a diffstat never reads as an operational state`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for ink in appearance.palette.diff.all {
            for state in appearance.palette.state.all {
                #expect(ink.color.distance(to: state.color) > 0.25)
            }
            #expect(ink.color.distance(to: appearance.palette.interaction.accent) > 0.25)
        }
    }

    @Test(arguments: palettes)
    func `added and removed are told apart by more than a hue nobody can name`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(
            appearance.palette.diff.added
                .distance(to: appearance.palette.diff.removed) > 0.25,
        )
    }

    // MARK: - Legibility

    @Test(arguments: palettes)
    func `text roles clear their contrast floor on the deck`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let base = appearance.palette.surface.base
        #expect(appearance.palette.text.primary.contrastRatio(on: base) >= 7)
        #expect(appearance.palette.text.secondary.contrastRatio(on: base) >= 4.5)
        #expect(appearance.palette.text.tertiary.contrastRatio(on: base) >= 4.5)
    }

    @Test(arguments: palettes)
    func `every state ink and the accent stay legible as a word, not just as a dot`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let base = appearance.palette.surface.base
        let inks = (appearance.palette.state.all + appearance.palette.diff.all).map(\.color)
        for ink in inks + [appearance.palette.interaction.accent] {
            #expect(ink.contrastRatio(on: base) >= 4.5)
        }
    }

    /// Ghosting a whole surface takes every ink on it down at once — the one device in the contract
    /// that can push a rung under its own floor. Held by a RELATIONSHIP rather than a second
    /// number: a ghosted row's ink stays at least as present as `disabled`.
    @Test(arguments: palettes)
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

    /// A hue in this palette means something — brand, one of four operational states, one of two
    /// diff inks — and a rung of the text ramp is a loudness, not a meaning.
    @Test(arguments: palettes)
    func `every text rung is neutral — the ramp is loudness, never meaning`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for rung in appearance.palette.text.all where rung.name != "onAccent" {
            #expect(rung.color.chromaticSpread <= 0.08)
        }
    }

    /// A marked `code` span is found by its GROUND, and it lands on two surfaces — a prompt says
    /// the same words inside a raised bubble. It must also outrun the row washes.
    @Test(arguments: palettes)
    func `a marked span's ground separates on both surfaces and outruns the row washes`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let surface = appearance.palette.surface
        for ground in [surface.base, surface.raised] {
            #expect(surface.marked.composited(over: ground).distance(to: ground) > 0.02)
        }
        #expect(surface.marked.opacity > surface.hover.opacity)
        #expect(surface.marked.opacity > surface.selected.opacity)
    }

    /// Why `TextRoles.marked(on:)` exists: the span inherits its voice, and the quietest voice
    /// would fall under the contrast floor once the ground lifts the backdrop out from under it.
    @Test(arguments: palettes)
    func `a marked span stays legible in every voice, on both surfaces`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let surface = appearance.palette.surface
        for voice in [text.primary, text.secondary, text.tertiary] {
            for ground in [surface.base, surface.raised] {
                let chip = surface.marked.composited(over: ground)
                #expect(text.marked(on: voice).contrastRatio(on: chip) >= 4.5)
            }
        }
    }

    /// The hierarchy the floor must not flatten: a marked run inside reasoning stays quieter than
    /// one inside an answer, or the thought starts shouting over the message it produced.
    @Test(arguments: palettes)
    func `a marked span in a thought stays quieter than one in a message`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let chip = appearance.palette.surface.marked
            .composited(over: appearance.palette.surface.base)
        let thought = text.marked(on: text.tertiary).contrastRatio(on: chip)
        let message = text.marked(on: text.primary).contrastRatio(on: chip)
        #expect(thought < message)
    }

    @Test(arguments: palettes)
    func `text on an accent fill is legible`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(
            appearance.palette.text.onAccent
                .contrastRatio(on: appearance.palette.interaction.accent) >= 4.5,
        )
    }
}
