import ArgoDesign
@testable import ArgoUI
import Testing

/// Which hue a role may be, and which it must stay away from — rules a colour tweak could break
/// silently: the neutral ramp stays grey and ordered, the brand hue is selection and focus and
/// nothing operational, the diff inks are neither, and the text ramp is a loudness not a meaning.
///
/// Whether those roles can be READ where they land is `VisualContractLegibilityTests`, and the one
/// span with a ground of its own is `VisualContractMarkedSpanTests`.
///
/// Every colour claim is parameterised over `ArgoPalette.all` rather than written against
/// `graphite`, so a light appearance arrives already governed: the rules are about RELATIONSHIPS
/// between roles — separation, ordering, contrast — not about absolute values.
@Suite("Visual contract")
struct VisualContractTests {
    let palette = ArgoPalette.graphite

    // MARK: - The neutral ramp

    @Test(arguments: VisualContractFixture.palettes)
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
    @Test(arguments: VisualContractFixture.palettes)
    func `the ramp steps monotonically, so depth reads off tone alone`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let luminances = appearance.palette.surface.ramp.map(\.relativeLuminance)
        #expect(luminances == luminances.sorted() || luminances == luminances.sorted().reversed())
        #expect(Set(luminances).count == luminances.count)
    }

    // MARK: - Ion Blue is brand, never status

    @Test(arguments: VisualContractFixture.palettes)
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

    @Test(arguments: VisualContractFixture.palettes)
    func `the destructive ground is neither the brand nor the failure ink`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let destructive = appearance.palette.interaction.destructive
        #expect(destructive.distance(to: appearance.palette.interaction.accent) > 0.25)
        // Inches apart on one swiped roster row, and two different claims — see `DiffRoles`.
        #expect(destructive.distance(to: appearance.palette.state.failure) > 0.25)
        // The mark on it is the row's own brightest ink, not the near-black Ion Blue takes.
        #expect(appearance.palette.text.primary
            .contrastRatio(on: destructive) >= VisualContractFixture.floor)
    }

    @Test(arguments: VisualContractFixture.palettes)
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

    @Test(arguments: VisualContractFixture.palettes)
    func `idle is a neutral slate — finished work recedes, it does not celebrate`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(appearance.palette.state.idle.chromaticSpread <= 0.08)
    }

    // MARK: - The diff inks are their own roles

    /// The two sit inches apart in one feed: `+8` next to a live Session's dot may not be the same
    /// green.
    @Test(arguments: VisualContractFixture.palettes)
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

    @Test(arguments: VisualContractFixture.palettes)
    func `added and removed are told apart by more than a hue nobody can name`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        #expect(
            appearance.palette.diff.added
                .distance(to: appearance.palette.diff.removed) > 0.25,
        )
    }

    /// A hue in this palette means something — brand, one of four operational states, one of two
    /// diff inks — and a rung of the text ramp is a loudness, not a meaning.
    @Test(arguments: VisualContractFixture.palettes)
    func `every text rung is neutral — the ramp is loudness, never meaning`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for rung in appearance.palette.text.all where rung.name != "onAccent" {
            #expect(rung.color.chromaticSpread <= 0.08)
        }
    }
}
