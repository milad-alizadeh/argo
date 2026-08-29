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
    /// Liquid Glass. It is not — but a macOS that starts ignoring it takes the fix
    /// with it silently, and every assertion above would still pass, because they read back a
    /// property rather than a pixel. This one draws the control and looks.
    @Test
    func `the bezel colour AppKit is given is the one AppKit draws`() throws {
        let control = RoomSegments.makeControl(palette: .graphite)
        control.selectedSegmentBezelColor = .systemRed
        control.selectedSegment = 0

        let fill = try #require(Self.fillOfFirstSegment(control))

        #expect(fill.redComponent > fill.greenComponent + 0.2)
        #expect(fill.redComponent > fill.blueComponent + 0.2)
    }

    /// Drawn into a bitmap rather than screenshotted: a package test has no window, and the claim
    /// is about what the control paints rather than about where it lands.
    private static func fillOfFirstSegment(_ control: NSSegmentedControl) -> NSColor? {
        let host = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 40))
        control.frame = NSRect(x: 0, y: 5, width: 300, height: 30)
        host.addSubview(control)
        guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return nil }
        host.cacheDisplay(in: host.bounds, to: rep)
        return rep.colorAt(x: 50, y: 20)?.usingColorSpace(.sRGB)
    }
}
