import ArgoDesign
@testable import ArgoUI
import Testing

/// That the pairing between a KIND of line and the rung it is set in holds — the rule `TextRoles`
/// left unsaid until #1250, when the shell had written itself into its quiet voices.
///
/// `VisualContractTests` holds the ramp itself and `VisualContractLegibilityTests` holds what it
/// can be read on. This suite holds the one thing neither could: which rung a title, a caption or
/// a section header is OWED.
@Suite("Text ink — a kind of line picks its rung")
struct TextInkContractTests {
    /// A title is the loudest thing the ramp has, on every appearance. Stated absolutely rather
    /// than as an ordering, because the whole fault was a title one rung down (`BacklogRowInk`).
    @Test(arguments: VisualContractFixture.palettes)
    func `a title takes the loudest rung`(_ appearance: (name: String, palette: ArgoPalette)) {
        let text = appearance.palette.text
        #expect(text.ink(.title) == text.primary)
    }

    /// Prose reads under the heading over it. A relationship, so a retune of either rung keeps it.
    @Test(arguments: VisualContractFixture.palettes)
    func `prose reads quieter than the title over it`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let base = appearance.palette.surface.base
        #expect(text.ink(.body).contrastRatio(on: base) < text.ink(.title).contrastRatio(on: base))
    }

    /// A caption reads quieter still — the three quiet kinds sit at or under the body's own rung.
    @Test(arguments: VisualContractFixture.palettes)
    func `a caption reads no louder than the prose beside it`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let base = appearance.palette.surface.base
        let body = text.ink(.body).contrastRatio(on: base)
        for kind in [ArgoLineKind.sectionHeader, .metadata, .machineFact] {
            #expect(
                text.ink(kind).contrastRatio(on: base) <= body,
                "\(appearance.name): \(kind.rawValue) reads louder than running prose",
            )
        }
    }

    /// The fault this suite exists for: `disabled` is an absence, and it carries no contrast
    /// floor, so live text on it can fall under AA with nothing to say so. Exactly one kind
    /// reaches that rung, and it is the one named for it.
    @Test(arguments: VisualContractFixture.palettes)
    func `only a disabled line reaches the disabled rung`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        for kind in ArgoLineKind.allCases where kind.isLive {
            #expect(
                text.ink(kind) != text.disabled,
                "\(appearance.name): \(kind.rawValue) is live text on the disabled rung",
            )
        }
        #expect(text.ink(.disabled) == text.disabled)
    }

    /// Every live kind clears AA on BOTH grounds a line is read on — the deck, and the selection
    /// ground under a selected row. The same two grounds `TextRoles.contrastFloor` names, so a
    /// kind cannot be paired with a rung that is only legible on one of them.
    @Test(arguments: VisualContractFixture.palettes)
    func `every live kind clears the floor on both grounds`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let grounds = [
            ("surface.base", appearance.palette.surface.base),
            ("interaction.selectionGround", appearance.palette.interaction.selectionGround),
        ]
        for kind in ArgoLineKind.allCases where kind.isLive {
            for ground in grounds {
                #expect(
                    text.ink(kind).contrastRatio(on: ground.1) >= VisualContractFixture.floor,
                    "\(appearance.name): \(kind.rawValue) is under AA on \(ground.0)",
                )
            }
        }
    }

    /// Every kind resolves to a rung the ramp actually ships. A pairing that answered with a
    /// colour off the ramp would be a hue where a loudness belongs — the one thing `TextRoles`
    /// forbids outright — and `onAccent` is not a rung: it is legible on one fill and nowhere
    /// else.
    @Test(arguments: VisualContractFixture.palettes)
    func `every kind resolves to a rung of the ramp`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let rungs = [text.primary, text.secondary, text.tertiary, text.disabled]
        for kind in ArgoLineKind.allCases {
            #expect(
                rungs.contains(text.ink(kind)),
                "\(appearance.name): \(kind.rawValue) resolves to an ink that is not on the ramp",
            )
        }
    }
}
