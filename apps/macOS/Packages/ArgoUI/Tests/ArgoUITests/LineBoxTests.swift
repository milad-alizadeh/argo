import AppKit
import ArgoDesign
@testable import ArgoUI
import ProseText
import Testing

/// A line's box is read off the face the platform RESOLVES, and everything measuring a line it
/// also draws reads the same one.
///
/// The drawn box and the ladder's nominal number differ at every rung, which is what lets the
/// cases below fail rather than restate their subject. Only that they differ: WHICH is larger is
/// a property of the machine, and asserting a direction reds on CI — `body` resolves to 17.31
/// against 15.73 nominal on one box and to 15.31 on another. Nothing in a test process can move an
/// Accessibility text setting either, so what is pinned is the source each measure reads.
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
    /// that annotation file names — and it was being given the nominal number, which is a different
    /// number and on this machine a smaller one.
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

    /// The chrome's number is a different quantity and keeps a different name. Nothing there clips
    /// on either side of the difference, because a badge asks for a `minHeight` and the `/` menu's
    /// rows carry 12pt of padding — slack absorbs it, and the design approved these.
    @Test
    func `the ladder's nominal box is not the drawn one`() {
        #expect(ArgoTypography.body.nominalLineBox == Self.nominal(.body))
        #expect(ArgoTypography.body.nominalLineBox != ArgoTypeScale.body.drawnLineBox)
    }

    /// Which box the leading is worked out from, which is the whole of #1026 and the one thing
    /// here a machine cannot decide: the drawn box and the nominal one differ at every rung, so a
    /// step taken off the nominal number is a different step wherever the fix is undone.
    ///
    /// Stated as the inequality it is. Asserting the step's VALUE proves nothing — the rhythm's
    /// literal is on both sides of that equation, and it holds for any number put there.
    @Test
    func `the feed's prose leading is not worked out from the nominal box`() {
        #expect(ProseFace.body.step != Self.stepLeading(ProseFace.body, off: Self.nominal(.body)))
    }

    /// The mono's own, off the chrome role's nominal box — the second half of the same bug, which
    /// took its leading from a rung the feed does not draw at.
    @Test
    func `the feed's mono leading is not worked out from the chrome's box`() {
        let chrome = ArgoTypography.machine.nominalLineBox
        #expect(ProseFace.machine.step != Self.stepLeading(ProseFace.machine, off: chrome))
    }

    /// And it is measured in the box it is DRAWN in rather than the chrome role's:
    /// `.system(.body, design: .monospaced)` keeps the body's line box and moves only the
    /// advances. Also #1026.
    @Test
    func `the feed's mono is boxed at the rung it is drawn at`() {
        #expect(
            ProseFace.machine.lineBox(under: .fractional) == ArgoFeedRow.machineRung.drawnLineBox,
        )
    }

    /// Where a line would stand if the leading came off `box` rather than the box the face is
    /// drawn at — at the face's own rhythm either way, as `ProseFace.leading` picks it.
    private static func stepLeading(_ face: ProseFace, off box: CGFloat) -> CGFloat {
        let rhythm = face.isMachine ? ArgoFeedRow.machineLineHeight : ArgoFeedRow.lineHeight
        return face.lineBox(under: .fractional) + max(0, rhythm - box)
    }
}
