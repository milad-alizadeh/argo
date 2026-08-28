@testable import ArgoUI
import Foundation
import Testing

/// The `AccentColor` asset against the role it is supposed to carry.
///
/// This exists because the two cannot be made one thing: the asset is the only route to the
/// placements of the brand hue that read no palette — the rooms picker's selected segment, which
/// `NSSegmentedControl` fills with it under Liquid Glass, and the system's own focus rings. D30
/// recorded that the asset and the palette must agree, and left it to whoever edited one to
/// remember the other. They drifted anyway. This is the gate.
///
/// It reads the file out of the repository rather than the built bundle: an `ArgoUI` test builds
/// the package alone and cannot see an asset catalogue that belongs to the app target.
@Suite("Accent asset")
struct AccentAssetTests {
    @Test
    func `the shipped asset carries the palette's brand hue at full strength`() throws {
        let shipped = try Self.shippedAccent()
        // Full strength, not `selectionGround`: what the asset reaches is the LOUD rung — a
        // selected segment, a focus ring. The roster's quiet ground is drawn from the palette.
        let role = ArgoPalette.graphite.interaction.accent
        // Whole 8-bit steps: the asset is written in them, so anything finer is a rounding
        // argument rather than a difference anybody can see.
        #expect(Self.byte(shipped.red) == Self.byte(role.red))
        #expect(Self.byte(shipped.green) == Self.byte(role.green))
        #expect(Self.byte(shipped.blue) == Self.byte(role.blue))
        #expect(shipped.opacity == 1)
    }

    private static func byte(_ channel: Double) -> Int {
        Int((channel * 255).rounded())
    }

    /// The one colour in the catalogue, as the contract's own type.
    private static func shippedAccent() throws -> ArgoColor {
        let data = try Data(contentsOf: assetURL)
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let colors = root?["colors"] as? [[String: Any]]
        let components = (colors?
            .first?["color"] as? [String: Any])?["components"] as? [String: String]
        let component = try #require(components)
        let alpha = try #require(component["alpha"])
        return try ArgoColor(
            red: channel(component["red"]),
            green: channel(component["green"]),
            blue: channel(component["blue"]),
            opacity: #require(Double(alpha)),
        )
    }

    /// Xcode writes these as `0xNN`. Nothing else is accepted: a float or a decimal here would be
    /// a second notation for one value, and this is the file that exists to stop exactly that.
    private static func channel(_ written: String?) throws -> Double {
        let text = try #require(written)
        let digits = text.hasPrefix("0x") ? String(text.dropFirst(2)) : nil
        let hex = try #require(digits)
        let byte = try #require(UInt8(hex, radix: 16))
        return Double(byte) / 255
    }

    /// `#filePath` walks to the app target, which is five levels up from this suite:
    /// `apps/macOS/Packages/ArgoUI/Tests/ArgoUITests`.
    private static var assetURL: URL {
        var root = URL(filePath: #filePath)
        for _ in 0 ..< 5 {
            root.deleteLastPathComponent()
        }
        return root.appending(path: "Argo/Assets.xcassets/AccentColor.colorset/Contents.json")
    }
}
