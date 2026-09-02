import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The one span the contract gives a ground of its own: a marked `code` run, which lands on two
/// surfaces and has to separate from both, stay legible in every voice over them, and keep the
/// hierarchy between a thought and the message it produced.
///
/// The one place a ground and an ink are asserted together; the separation rules alone are
/// `VisualContractTests`.
@Suite("Visual contract marked span")
struct VisualContractMarkedSpanTests {
    /// A marked `code` span is found by its GROUND, and it lands on two surfaces — a prompt says
    /// the same words inside a raised bubble. It must also outrun the row washes.
    @Test(arguments: VisualContractFixture.palettes)
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
    @Test(arguments: VisualContractFixture.palettes)
    func `a marked span stays legible in every voice, on both surfaces`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let text = appearance.palette.text
        let surface = appearance.palette.surface
        for voice in [text.primary, text.secondary, text.tertiary] {
            for ground in [surface.base, surface.raised] {
                let chip = surface.marked.composited(over: ground)
                #expect(text.marked(on: voice).contrastRatio(on: chip) >= VisualContractFixture
                    .floor)
            }
        }
    }

    /// The hierarchy the floor must not flatten: a marked run inside reasoning stays quieter than
    /// one inside an answer, or the thought starts shouting over the message it produced.
    @Test(arguments: VisualContractFixture.palettes)
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
}
