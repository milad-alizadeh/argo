import ArgoEngine
import SwiftUI

/// How one provider label's own colour is read into the three inks a chip draws with.
///
/// **The hue is the provider's; the treatment is Argo's.** A tracker serves one colour per label,
/// chosen against a white page, and setting it as a chip's ground on this deck gives a `bug` in
/// GitHub's own red a ground brighter than any surface in the room. So the hue is kept and its
/// weight is not: it grounds at a wash, edges at a hairline's worth, and is lifted to a floor of
/// lightness for the word itself. The reader still recognises the label they set; the chip still
/// belongs to the deck it sits on. The three measures are `ArgoTicketDetail`'s.
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
        let lifted = hue.lifted(to: ArgoTicketDetail.labelWordLightness)
        self.ground = lifted.opacity(ArgoTicketDetail.labelGroundWash)
        self.edge = lifted.opacity(ArgoTicketDetail.labelEdgeWash)
        self.word = lifted
    }
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

    /// The same hue at no less than `floor` relative luminance — the contract's own measure, so
    /// this reads legibility the way every other colour claim in the package does.
    ///
    /// **Scaled first, blended only for what scaling could not reach.** Scaling keeps the hue, so
    /// two labels a reader chose as different colours stay different; but a channel that hits 1
    /// stops contributing, and a saturated mid-blue runs out of headroom below the floor. The
    /// residual is then blended toward white, which desaturates — and a word that reads slightly
    /// paler than the tracker's is worth more than one nobody can read at all.
    func lifted(to floor: Double) -> ArgoColor {
        guard relativeLuminance < floor else { return self }
        return scaled(to: floor).whitened(to: floor)
    }

    /// As far toward the floor as multiplying the channels gets, which is all the way unless one
    /// of them clamps. A pure black has nothing to multiply and comes back unchanged, for
    /// `whitened` to take the whole distance.
    private func scaled(to floor: Double) -> ArgoColor {
        guard relativeLuminance > 0 else { return self }
        let gain = floor / relativeLuminance
        return ArgoColor(
            red: min(1, red * gain),
            green: min(1, green * gain),
            blue: min(1, blue * gain),
            opacity: opacity,
        )
    }

    /// The rest of the way, mixed toward white. Iterated rather than solved: `relativeLuminance`
    /// linearises each channel, so luminance is NOT linear in the values being mixed and a
    /// closed-form fraction would undershoot. Bisection converges in a fixed number of steps and
    /// cannot loop.
    private func whitened(to floor: Double) -> ArgoColor {
        guard relativeLuminance < floor else { return self }
        var low = 0.0
        var high = 1.0
        for _ in 0 ..< Self.bisections {
            let mid = (low + high) / 2
            if mixedWithWhite(mid).relativeLuminance < floor {
                low = mid
            } else {
                high = mid
            }
        }
        return mixedWithWhite(high)
    }

    private func mixedWithWhite(_ mix: Double) -> ArgoColor {
        ArgoColor(
            red: red + (1 - red) * mix,
            green: green + (1 - green) * mix,
            blue: blue + (1 - blue) * mix,
            opacity: opacity,
        )
    }

    /// Enough to land the mix within a 255th of a channel step, which is finer than the display
    /// can draw.
    private static let bisections = 12
}
