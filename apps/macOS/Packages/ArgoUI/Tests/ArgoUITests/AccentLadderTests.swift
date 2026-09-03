import ArgoDesign
@testable import ArgoUI
import Testing

/// The brand hue at the three weights a tint is laid down at — the ladder `StateRoles` already
/// spends, now spelled for the accent because the map lays it under a region and rims a volume
/// with it (#1142).
@Suite("Accent ladder — one hue, three weights")
struct AccentLadderTests {
    static let palettes = ArgoPalette.all

    /// Three weights of ONE hue: the rungs get louder in one direction, and every one of them
    /// resolves back to the accent when the weight is taken off.
    @Test(arguments: palettes)
    func `the ladder gets louder in one direction and is the accent throughout`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let interaction = appearance.palette.interaction
        let rungs = ArgoTint.allCases.map { interaction.accent(at: $0) }
        let weights = rungs.map(\.opacity)
        #expect(zip(weights, weights.dropFirst()).allSatisfy { $1 > $0 })
        for rung in rungs {
            #expect(rung.opacity(1) == interaction.accent)
        }
    }

    /// One ladder, not two: the weights the accent is laid down at are the weights a state is laid
    /// down at, so a wash means the same strength wherever it is read.
    @Test(arguments: palettes)
    func `it is the same ladder the operational states are laid down at`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let state = palette.state
        #expect(palette.interaction.accent(at: .wash).opacity == state.wash(state.idle).opacity)
        #expect(palette.interaction.accent(at: .muted).opacity == state.muted(state.idle).opacity)
        #expect(palette.interaction.accent(at: .rim).opacity == state.rim(state.idle).opacity)
    }

    /// The rungs are DERIVED, so `Mirror` cannot reach them and the coverage guard over the colour
    /// groups never sees one. This catalogue is what stands in: the specimen draws it by hand, and
    /// a rung missing from it is a weight nobody has looked at.
    @Test(arguments: palettes)
    func `every rung reaches the specimen through its own catalog`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let interaction = appearance.palette.interaction
        #expect(interaction.ladder.map(\.name) == ["accent wash", "accent muted", "accent rim"])
        #expect(interaction.ladder.map(\.color) == ArgoTint.allCases.map {
            interaction.accent(at: $0)
        })
    }
}
