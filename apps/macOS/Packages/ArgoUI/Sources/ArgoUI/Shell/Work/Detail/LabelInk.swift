import ArgoEngine
import SwiftUI

/// How one provider label's own colour is read into the three inks a chip draws with.
///
/// **The hue is the provider's; the treatment is Argo's.** A tracker serves one colour per label,
/// chosen against a white page, and setting it as a chip's ground on this deck gives a `bug` in
/// GitHub's own red a ground brighter than any surface in the room. So the hue is kept and its
/// weight is not: it grounds at a wash, edges at a hairline's worth, and is moved for the word
/// itself only as far as reading it demands. The reader still recognises the label they set; the
/// chip still belongs to the deck it sits on. The measures are `ArgoTicketDetail`'s.
///
/// A label the provider gave no colour reads as `nil` and the chip keeps its neutral — the same
/// silence `TicketLabel.colour` carries, not a hue invented to fill it.
struct LabelInk: Equatable {
    let ground: ArgoColor
    let edge: ArgoColor
    let word: ArgoColor

    /// Nothing was read, so nothing is claimed.
    ///
    /// `backdrop` is the surface the chip sits on, and the word is measured AGAINST it rather than
    /// against an absolute: what makes a word readable is its contrast with the ground under it,
    /// so a hue already clear of this deck is left exactly as the provider set it.
    init?(_ label: TicketLabel, on backdrop: ArgoColor) {
        guard let hue = ArgoColor(providerHex: label.colour) else { return nil }
        let read = hue.carried(to: ArgoTicketDetail.labelWordContrast, on: backdrop)
        self.ground = read.opacity(ArgoTicketDetail.labelGroundWash)
        self.edge = read.opacity(ArgoTicketDetail.labelEdgeWash)
        self.word = read
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

    /// The same hue, carried away from `backdrop` until it reads at `ratio` against it — measured
    /// with the contract's own `contrastRatio(on:)`, so this is the measure every other colour
    /// claim in the package is made with.
    ///
    /// **Against the backdrop, not to an absolute lightness.** A luminance floor moves every hue by
    /// the same rule whatever it sits on, which on a dark deck over-lifts the saturated mid-tones
    /// that were already legible — GitHub's blue came out cyan. Contrast asks the question that
    /// actually matters, and a hue already clear of the ground is returned untouched.
    ///
    /// **The direction is the backdrop's**, so this holds when the light appearance lands: a dark
    /// surface carries the word toward white, a light one toward black.
    ///
    /// Where even the extreme cannot reach the ratio, the extreme is what comes back. That is the
    /// honest answer — the alternative is refusing to draw a label the provider set.
    func carried(to ratio: Double, on backdrop: ArgoColor) -> ArgoColor {
        guard contrastRatio(on: backdrop) < ratio else { return self }
        let limit = backdrop.relativeLuminance < Self.midLuminance ? 1.0 : 0.0
        guard moved(toward: limit, by: 1).contrastRatio(on: backdrop) >= ratio else {
            return moved(toward: limit, by: 1)
        }
        return settled(at: ratio, on: backdrop) { self.moved(toward: limit, by: $0) }
    }

    /// The hue at `amount` of the way to `limit`, which is white or black.
    ///
    /// The first half MULTIPLIES the channels, because that holds the hue exactly; the second half
    /// mixes, because a channel that has clamped stops contributing and scaling alone runs out of
    /// headroom on a dark saturated colour. Two labels a reader chose as different colours stay
    /// different for as long as the hue can carry them.
    private func moved(toward limit: Double, by amount: Double) -> ArgoColor {
        let scaling = min(1, amount * 2)
        let mixing = max(0, amount * 2 - 1)
        let gain = 1 + scaling * (Self.gainCeiling - 1)
        // Toward black there is nothing to gain by multiplying up, so the scale half is inert and
        // the mix does the whole distance.
        let lit = limit > 0 ? 1.0 : 0.0
        return ArgoColor(
            red: Self.channel(red, gain: limit > 0 ? gain : 1, toward: lit, by: mixing),
            green: Self.channel(green, gain: limit > 0 ? gain : 1, toward: lit, by: mixing),
            blue: Self.channel(blue, gain: limit > 0 ? gain : 1, toward: lit, by: mixing),
            opacity: opacity,
        )
    }

    private static func channel(
        _ value: Double,
        gain: Double,
        toward limit: Double,
        by mix: Double,
    )
        -> Double {
        let scaled = min(1, value * gain)
        return scaled + (limit - scaled) * mix
    }

    /// The smallest `amount` of `make` that reaches `ratio`, found by bisection.
    ///
    /// Bisected and not solved: `relativeLuminance` linearises each channel and the scale half
    /// clamps at 1, so contrast is neither linear nor smooth in the amount applied and a closed
    /// form would undershoot. A fixed step count cannot loop.
    private func settled(
        at ratio: Double,
        on backdrop: ArgoColor,
        make: (Double) -> ArgoColor,
    )
        -> ArgoColor {
        var low = 0.0
        var high = 1.0
        for _ in 0 ..< Self.bisections {
            let mid = (low + high) / 2
            if make(mid).contrastRatio(on: backdrop) < ratio {
                low = mid
            } else {
                high = mid
            }
        }
        return make(high)
    }

    /// Enough to land within a 255th of a channel step, which is finer than the display can draw.
    private static let bisections = 12
    /// How far a hue may be multiplied before the mix takes over. Past this the bright channel has
    /// clamped and scaling is only desaturating by another name.
    private static let gainCeiling = 8.0
    /// Which side of the ramp a surface is on, so the word is carried away from it.
    private static let midLuminance = 0.18
}
