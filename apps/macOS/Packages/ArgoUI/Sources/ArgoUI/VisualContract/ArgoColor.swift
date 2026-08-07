import SwiftUI

/// A colour in the contract, held as sRGB components rather than as an opaque `Color`.
///
/// `Color` is a black box: nothing can ask it what it is, so nothing can assert that the
/// graphite ramp stayed neutral or that Ion Blue never leaked into a status role. Holding
/// the components keeps those claims testable without AppKit and without a running app.
public struct ArgoColor: Sendable, Hashable {
    public let red: Double
    public let green: Double
    public let blue: Double
    public let opacity: Double

    public init(red: Double, green: Double, blue: Double, opacity: Double = 1) {
        self.red = red
        self.green = green
        self.blue = blue
        self.opacity = opacity
    }

    /// `0xRRGGBB`, the notation the study is written in.
    public init(hex: UInt32, opacity: Double = 1) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity,
        )
    }

    public var color: Color {
        Color(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }

    public func opacity(_ opacity: Double) -> ArgoColor {
        ArgoColor(red: red, green: green, blue: blue, opacity: opacity)
    }
}

/// Lets a role be spelled straight into `.fill`, `.background` and `.foregroundStyle`
/// without a `.color` at every call site.
extension ArgoColor: ShapeStyle {
    public func resolve(in _: EnvironmentValues) -> Color.Resolved {
        Color.Resolved(
            colorSpace: .sRGB,
            red: Float(red),
            green: Float(green),
            blue: Float(blue),
            opacity: Float(opacity),
        )
    }
}

public extension ArgoColor {
    /// WCAG relative luminance.
    var relativeLuminance: Double {
        func linear(_ channel: Double) -> Double {
            channel <= 0.03928 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }

    /// Source-over compositing, so a translucent edge or wash can be measured against the
    /// surface it actually sits on rather than against nothing.
    func composited(over backdrop: ArgoColor) -> ArgoColor {
        ArgoColor(
            red: red * opacity + backdrop.red * (1 - opacity),
            green: green * opacity + backdrop.green * (1 - opacity),
            blue: blue * opacity + backdrop.blue * (1 - opacity),
            opacity: 1,
        )
    }

    /// WCAG contrast ratio. Both sides are composited onto `backdrop` first, so a
    /// translucent foreground is measured as rendered.
    func contrastRatio(on backdrop: ArgoColor) -> Double {
        let foreground = composited(over: backdrop).relativeLuminance
        let background = backdrop.relativeLuminance
        let lighter = max(foreground, background)
        let darker = min(foreground, background)
        return (lighter + 0.05) / (darker + 0.05)
    }

    /// How far the channels spread. Zero is a pure grey; a navy would push this open.
    var chromaticSpread: Double {
        max(red, green, blue) - min(red, green, blue)
    }

    /// Euclidean distance in sRGB. Crude as colour science, sufficient as a guard that two
    /// operational states never resolve to near-neighbours a glance would fuse.
    func distance(to other: ArgoColor) -> Double {
        let deltaRed = red - other.red
        let deltaGreen = green - other.green
        let deltaBlue = blue - other.blue
        return (deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue).squareRoot()
    }
}
