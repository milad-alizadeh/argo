import AppKit
@testable import ArgoUI
import Testing

/// A line's box is read off the face the platform RESOLVES, never worked out from the ladder's
/// documented number — and everything that measures a line it also draws reads the same one.
///
/// The two numbers differ at every rung on any machine that runs this, which is what lets these
/// cases fail rather than restate their subject: `caption1` is 12.1 documented against 13.78
/// drawn. Nothing in a test process can move an Accessibility text setting, so what is pinned is
/// the SOURCE each measure reads, at whatever setting the run is at.
@MainActor
@Suite("What a line of type occupies")
struct LineBoxTests {
    private static func nominal(_ rung: ArgoTypeScale) -> CGFloat {
        rung.size * ArgoTypeScale.naturalLineHeightRatio
    }

    @Test(arguments: ArgoTypeScale.allCases)
    func `the rung's box is the resolved face's, not the documented number's`(rung: ArgoTypeScale) {
        let face = NSFont.preferredFont(forTextStyle: rung.appKitStyle)

        #expect(rung.lineBox == face.ascender - face.descender)
        #expect(rung.lineBox != Self.nominal(rung))
    }

    /// The bug: `MinimapLaneView+Annotations` draws these labels with `preferredFont`, and the
    /// spacing that keeps two of them apart was measuring the documented number. Under ⇧⌘ every
    /// Turn asks for a label at once, so the shortfall is labels drawn on top of each other.
    @Test
    func `a minimap label is as tall as the label that is drawn`() {
        let rung = ArgoMinimapLane.labelRung
        let padding = ArgoMinimapLane.labelPadding * 2

        #expect(ArgoMinimapLane.labelHeight == rung.lineBox + padding)
        #expect(ArgoMinimapLane.labelHeight != Self.nominal(rung) + padding)
    }

    /// The mismatch this change does NOT fix, pinned so it cannot be lost: the feed's leading takes
    /// the nominal box off and `ProseFace.step` adds it to the drawn one, so a line stands over the
    /// rhythm its name promises. Correcting it re-spaces every line of the feed and belongs to the
    /// design (#1026) — this says by how much until then.
    @Test
    func `the feed's own lines stand over the rhythm they name, and by how much`() {
        #expect(ProseFace.body.step > ArgoFeedRow.lineHeight)
        #expect(ProseFace.body.step - ArgoFeedRow.lineHeight == ArgoTypeScale.body.lineBox
            - Self.nominal(.body))
        #expect(ProseFace.machine.step > ArgoFeedRow.machineLineHeight)
    }

    /// Why `ProseFace.lineBox` may read the rung alone: the system's bold is cut on the same body,
    /// so a heading's box is its rung's. Within a rounding step, which is all `NSFontManager`'s
    /// conversion leaves between them.
    @Test(arguments: ArgoTypeScale.allCases)
    func `the bold face stands in the same box as the regular`(rung: ArgoTypeScale) {
        let bold = NSFontManager.shared.convert(
            NSFont.preferredFont(forTextStyle: rung.appKitStyle), toHaveTrait: .boldFontMask,
        )

        #expect(abs((bold.ascender - bold.descender) - rung.lineBox) < 0.001)
    }

    /// The chrome's own number is a different quantity and stays one: a badge and the `/` menu's
    /// rows were reconciled against the documented derivation, and nothing there predicts a line
    /// it draws. It is named apart so the next reader does not take it for the drawn box.
    @Test
    func `the ladder's nominal box is not the drawn one`() {
        #expect(ArgoTypography.body.lineBox == Self.nominal(.body))
        #expect(ArgoTypography.body.lineBox < ArgoTypeScale.body.lineBox)
    }
}
