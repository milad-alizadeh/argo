import AppKit
@testable import ArgoUI
import Testing

/// The rooms picker against the one selected state its pane is allowed (#944).
///
/// Left alone `NSSegmentedControl` fills its selected segment from the `AccentColor` asset, which
/// carries the brand hue at full strength — a loud selection directly above the roster's own quiet
/// one, and a reader cannot tell which of the two names where they are. The bezel is set to a
/// neutral, and this suite is what keeps it set: the fill is the platform's, so the regression
/// would be an absence of code rather than a wrong line of it.
@Suite("Room segments")
@MainActor
struct RoomSegmentsTests {
    @Test
    func `the selected segment is bezelled in the neutral a current control takes`() {
        let palette = ArgoPalette.graphite
        let control = RoomSegments.makeControl(palette: palette)

        #expect(control.selectedSegmentBezelColor == palette.surface.selected.nsColor)
    }

    @Test
    func `that fill carries no hue, at either weight the brand is spent at`() throws {
        let palette = ArgoPalette.graphite
        let bezel = try #require(
            RoomSegments.makeControl(palette: palette)
                .selectedSegmentBezelColor?.usingColorSpace(.sRGB),
        )

        #expect(bezel.redComponent == bezel.greenComponent)
        #expect(bezel.greenComponent == bezel.blueComponent)
        #expect(bezel != palette.interaction.accent.nsColor)
        #expect(bezel != palette.interaction.selectionGround.nsColor)
    }

    /// The platform's behaviour, not Argo's, and the reason it is pinned here rather than written
    /// down: `RoomSegments` shipped carrying a comment that said this property was ignored under
    /// Liquid Glass. It is not — but a macOS that starts ignoring it takes the fix with it
    /// silently, and every assertion above would still pass, because they read back a property
    /// rather than a pixel. This one draws the control and looks.
    ///
    /// It compares two draws rather than measuring one against a threshold. How STRONGLY the glass
    /// composites the bezel varies with the environment — saturated where a window server is
    /// drawing the material, a pale tint on a CI runner where it is not — so any absolute channel
    /// distance is a claim about the renderer's strength rather than about the property. The
    /// direction survives both: whichever colour the bezel is given, the segment leans that way.
    /// Ignore the property and the two draws are identical, and both expectations fail.
    @Test
    func `the bezel colour AppKit is given is the one AppKit draws`() throws {
        let reddened = try #require(Self.fillOfFirstSegment(bezelled: .systemRed))
        let greened = try #require(Self.fillOfFirstSegment(bezelled: .systemGreen))

        #expect(reddened.redComponent > greened.redComponent)
        #expect(greened.greenComponent > reddened.greenComponent)
    }

    /// Drawn into a bitmap rather than screenshotted: a package test has no window, and the claim
    /// is about what the control paints rather than about where it lands. The appearance is forced
    /// because Argo ships one and a test that inherits the runner's would measure a second.
    private static func fillOfFirstSegment(bezelled colour: NSColor) -> NSColor? {
        let control = RoomSegments.makeControl(palette: .graphite)
        control.appearance = NSAppearance(named: .darkAqua)
        control.selectedSegmentBezelColor = colour
        control.selectedSegment = 0

        let host = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 40))
        control.frame = NSRect(x: 0, y: 5, width: 300, height: 30)
        host.addSubview(control)
        guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return nil }
        host.cacheDisplay(in: host.bounds, to: rep)
        return rep.colorAt(x: 50, y: 20)?.usingColorSpace(.sRGB)
    }
}
