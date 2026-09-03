import AppKit
import SwiftUI

/// A colour in the contract, held as sRGB components rather than as an opaque `Color` — nothing can
/// ask a `Color` what it is, so the contract's claims would not be assertable without AppKit.
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

    /// A colour named by where it sits on the wheel rather than by its channels — the notation a
    /// RULE is written in, where the hues are not decided in advance. `ArgoPalette.DomainWheel` is
    /// the one caller: a repository's domain count is not the contract's to know.
    ///
    /// Hue is in degrees and wraps, so a rank past the end of the wheel comes back round rather
    /// than clamping onto the last colour.
    public init(hue degrees: Double, saturation: Double, lightness: Double) {
        let turned = degrees.truncatingRemainder(dividingBy: 360)
        let sixth = (turned < 0 ? turned + 360 : turned) / 60
        let chroma = (1 - abs(2 * lightness - 1)) * saturation
        let second = chroma * (1 - abs(sixth.truncatingRemainder(dividingBy: 2) - 1))
        let dimmest = lightness - chroma / 2
        // Which channel leads is the sextant of the wheel the hue landed in.
        let channels: [Double] = switch Int(sixth) {
        case 0: [chroma, second, 0]
        case 1: [second, chroma, 0]
        case 2: [0, chroma, second]
        case 3: [0, second, chroma]
        case 4: [second, 0, chroma]
        default: [chroma, 0, second]
        }
        self.init(
            red: channels[0] + dimmest,
            green: channels[1] + dimmest,
            blue: channels[2] + dimmest,
        )
    }

    public var color: Color {
        Color(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }

    /// The same colour for a `CALayer` or a `CGContext`, neither of which can take a `Color`.
    public var cgColor: CGColor {
        CGColor(srgbRed: red, green: green, blue: blue, alpha: opacity)
    }

    /// The same colour again for AppKit, which takes neither — an `NSAttributedString`, or a
    /// property on a control reached through `NSViewRepresentable`.
    public var nsColor: NSColor {
        NSColor(srgbRed: red, green: green, blue: blue, alpha: opacity)
    }

    public func opacity(_ opacity: Double) -> ArgoColor {
        ArgoColor(red: red, green: green, blue: blue, opacity: opacity)
    }

    /// The same pigment, lit. Every channel by the same factor and nothing else touched, which is
    /// the whole of `ArgoLight`'s rule: a lit face is the colour of its legend swatch, darker or
    /// brighter, never a different hue and never washed toward white.
    ///
    /// Clamped at the top, so a factor above one brightens until the channel runs out rather than
    /// wrapping. Alpha is untouched: lighting a thing does not make it less present.
    public func scaled(by factor: Double) -> ArgoColor {
        ArgoColor(
            red: min(red * factor, 1),
            green: min(green * factor, 1),
            blue: min(blue * factor, 1),
            opacity: opacity,
        )
    }

    /// The colour `fraction` of the way from this one to another, alpha included — what a pass
    /// resolves to between two of its stops. Spent by `ArgoRamp.color(at:)`; no surface mixes two
    /// roles by hand.
    func mixed(with other: ArgoColor, by fraction: Double) -> ArgoColor {
        func between(_ from: Double, _ to: Double) -> Double {
            from + (to - from) * fraction
        }
        return ArgoColor(
            red: between(red, other.red),
            green: between(green, other.green),
            blue: between(blue, other.blue),
            opacity: between(opacity, other.opacity),
        )
    }

    /// No ground at all — a role's absence, spelled once and in the contract's own type.
    public static let transparent = ArgoColor(hex: 0x000000, opacity: 0)
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

/// The measures the contract's colour claims are made of. No surface draws one.
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
