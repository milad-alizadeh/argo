import ArgoEngine
import SwiftUI

/// How one provider label's own colour is read into the three inks a chip draws with.
///
/// **The hue is the provider's; the treatment is Argo's.** A tracker serves one colour per label,
/// chosen against a white page, and setting it as a chip's ground on this deck gives a `bug` in
/// GitHub's own red a ground brighter than any surface in the room. So the hue is kept and its
/// weight is not: it grounds at a wash, edges at a hairline's worth, and is lifted to a floor of
/// lightness for the word itself. The reader still recognises the label they set; the chip still
/// belongs to the deck it sits on.
///
/// A label the provider gave no colour reads as `nil` and the chip keeps its neutral — the same
/// silence `WorkItemLabel.colour` carries, not a hue invented to fill it.
struct LabelInk: Equatable {
    let ground: ArgoColor
    let edge: ArgoColor
    let word: ArgoColor

    /// Nothing was read, so nothing is claimed.
    init?(_ label: WorkItemLabel) {
        guard let hue = ArgoColor(providerHex: label.colour) else { return nil }
        let lifted = hue.lifted(to: Self.wordLightness)
        self.ground = lifted.opacity(Self.groundWash)
        self.edge = lifted.opacity(Self.edgeWash)
        self.word = lifted
    }

    /// A label set in a colour this deck cannot carry — GitHub's own `000000`, or a near-black
    /// chosen against a white page — is lifted to here rather than drawn as a word nobody can read.
    private static let wordLightness = 0.72
    private static let groundWash = 0.16
    private static let edgeWash = 0.38
}

extension ArgoColor {
    /// A provider's six hex digits, with or without the `#` it usually omits. `nil` for anything
    /// else, absence included: a colour Argo could not parse is one nobody stated.
    init?(providerHex: String?) {
        guard let providerHex else { return nil }
        let digits = providerHex.hasPrefix("#") ? String(providerHex.dropFirst()) : providerHex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(hex: value)
    }

    /// The same hue at no less than `floor` perceived lightness.
    ///
    /// **Scaled first, blended only for what scaling could not reach.** Scaling keeps the hue, so
    /// two labels a reader chose as different colours stay different; but a channel that hits 1
    /// stops contributing, and a saturated mid-blue runs out of headroom below the floor. The
    /// residual is then blended toward white, which desaturates — and a word that reads slightly
    /// paler than the tracker's is worth more than one nobody can read at all.
    func lifted(to floor: Double) -> ArgoColor {
        guard Self.luminance(of: self) < floor else { return self }
        return Self.whitened(Self.scaled(self, to: floor), to: floor)
    }

    private static func luminance(of ink: ArgoColor) -> Double {
        0.2126 * ink.red + 0.7152 * ink.green + 0.0722 * ink.blue
    }

    /// As far toward the floor as multiplying the channels gets, which is all the way unless one
    /// of them clamps. A pure black has nothing to multiply and comes back unchanged, for
    /// `whitened` to take the whole distance.
    private static func scaled(_ ink: ArgoColor, to floor: Double) -> ArgoColor {
        let luminance = luminance(of: ink)
        guard luminance > 0 else { return ink }
        let gain = floor / luminance
        return ArgoColor(
            red: min(1, ink.red * gain),
            green: min(1, ink.green * gain),
            blue: min(1, ink.blue * gain),
            opacity: ink.opacity,
        )
    }

    /// The rest of the way, mixed toward white. `mix` is exact rather than iterated: luminance is
    /// linear in the channels, so the fraction that closes the gap can be solved for directly.
    private static func whitened(_ ink: ArgoColor, to floor: Double) -> ArgoColor {
        let luminance = luminance(of: ink)
        guard luminance < floor else { return ink }
        let mix = (floor - luminance) / (1 - luminance)
        return ArgoColor(
            red: ink.red + (1 - ink.red) * mix,
            green: ink.green + (1 - ink.green) * mix,
            blue: ink.blue + (1 - ink.blue) * mix,
            opacity: ink.opacity,
        )
    }
}
