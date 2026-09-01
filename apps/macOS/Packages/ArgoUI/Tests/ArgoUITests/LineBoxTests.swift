import AppKit
@testable import ArgoUI
import Testing

/// A line's box is read off the face the platform RESOLVES, and everything measuring a line it
/// also draws reads the same one.
///
/// The drawn box and the ladder's nominal number differ at every rung at the setting these run
/// at — `caption1` is 12.1 against 13.78 — which is what lets the cases below fail rather than
/// restate their subject. Nothing in a test process can move an Accessibility text setting, so
/// what is pinned is the source each measure reads, at whatever setting the run is at.
@MainActor
@Suite("What a line of type occupies")
struct LineBoxTests {
    private static func nominal(_ rung: ArgoTypeScale) -> CGFloat {
        rung.size * ArgoTypeScale.naturalLineHeightRatio
    }

    /// The precondition every case below rests on. An inequality on floats, deliberately: the two
    /// numbers coinciding at some rung would make the rest of this suite silently vacuous there.
    @Test(arguments: ArgoTypeScale.allCases)
    func `the drawn box is not the ladder's nominal number`(rung: ArgoTypeScale) {
        #expect(rung.drawnLineBox != Self.nominal(rung))
    }

    /// The bug. `MinimapLaneView+Annotations` fills the label's ground at `labelHeight` and insets
    /// its text by `labelPadding`, so the inset rect has to hold the glyphs of one line in the font
    /// that annotation file names — and it was being given the nominal number, 1.68pt short of them
    /// at `caption1`.
    @Test
    func `a minimap label's text rect holds the glyphs drawn in it`() {
        let drawn = NSFont.preferredFont(forTextStyle: ArgoMinimapLane.labelRung.appKitStyle)
        let inset = ArgoMinimapLane.labelHeight - ArgoMinimapLane.labelPadding * 2

        #expect(inset >= drawn.ascender - drawn.descender)
    }

    /// The same number is also the closest two labels may be. Under ⇧⌘ every Turn asks for one at
    /// once, so a height short of the drawn line is labels drawn over each other.
    @Test
    func `a minimap label is as tall as the label that is drawn`() {
        let padding = ArgoMinimapLane.labelPadding * 2

        #expect(ArgoMinimapLane.labelHeight == ArgoMinimapLane.labelRung.drawnLineBox + padding)
    }

    /// Why `ProseFace.lineBox` may read the rung alone: the system's bold is cut on the same body,
    /// so a heading's box is its rung's. Within a rounding step, which is all `NSFontManager`'s
    /// conversion leaves between them.
    @Test(arguments: ArgoTypeScale.allCases)
    func `the bold face stands in the same box as the regular`(rung: ArgoTypeScale) {
        let bold = NSFontManager.shared.convert(
            NSFont.preferredFont(forTextStyle: rung.appKitStyle), toHaveTrait: .boldFontMask,
        )

        #expect(abs((bold.ascender - bold.descender) - rung.drawnLineBox) < 0.001)
    }

    /// The chrome's number is a different quantity and keeps a different name. It is short of the
    /// drawn line and nothing there clips, because a badge asks for a `minHeight` and the `/`
    /// menu's rows carry 12pt of padding — slack absorbs it, and the design approved these.
    @Test
    func `the ladder's nominal box is short of the drawn one`() {
        #expect(ArgoTypography.body.nominalLineBox == Self.nominal(.body))
        #expect(ArgoTypography.body.nominalLineBox < ArgoTypeScale.body.drawnLineBox)
    }

    /// Pinned so it cannot be lost: the feed's leading takes the nominal box off and `ProseFace`
    /// adds it to the drawn one, so prose stands over the rhythm its name promises. Correcting it
    /// re-spaces every line of the feed and belongs to the design — #1026.
    @Test
    func `the feed's prose stands over the rhythm it names`() {
        let over = ProseFace.body.step - ArgoFeedRow.lineHeight

        #expect(abs(over - (ArgoTypeScale.body.drawnLineBox - Self.nominal(.body))) < 0.001)
    }

    /// And the mono for a second reason too: `ArgoTypography.machine`'s rung is not the rung the
    /// feed draws its mono at. Also #1026.
    @Test
    func `the feed's mono stands over the rhythm it names`() {
        #expect(ProseFace.machine.step > ArgoFeedRow.machineLineHeight)
    }
}
