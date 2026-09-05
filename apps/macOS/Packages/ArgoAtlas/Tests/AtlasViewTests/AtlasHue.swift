import ArgoDesign
@testable import AtlasLayout

/// One drawn colour, read as the band it can only have come from.
///
/// Hue and saturation, never value: value is exactly what the light spends, and a claim about it
/// would be a second copy of `AtlasLighting` written in a test.
struct AtlasHue {
    /// How far off a band's own hue a pixel may sit and still be that band. Degrees, and it exists
    /// for one reason: an 8-bit channel quantises, and a wall at the foot of its contact gradient
    /// is dark enough that a degree or two falls out of the rounding. Far under the 40° that
    /// separates the closest two things on the map.
    static let tolerance = 15.0
    /// Under this, a colour has no hue worth reading — the desktop, the plates and their rims are
    /// all cool greys, and every one of them is under it while all three bands are well over.
    static let leastSaturation = 0.25

    let red: Double
    let green: Double
    let blue: Double

    var band: AtlasBand? {
        guard saturation >= Self.leastSaturation else { return nil }
        let mine = degrees
        return [AtlasBand.quiet, .middling, .hot].first { band in
            let theirs = AtlasHue(ArgoPalette.graphite.atlas.measure.colour(of: band)).degrees
            let apart = abs(mine - theirs)
            return min(apart, 360 - apart) <= Self.tolerance
        }
    }

    private var high: Double {
        max(red, max(green, blue))
    }

    private var low: Double {
        min(red, min(green, blue))
    }

    private var saturation: Double {
        high > 0 ? (high - low) / high : 0
    }

    /// The hue in degrees, the textbook way round the wheel. Zero for a colour with no hue, which
    /// `band` never reaches: `saturation` has already answered for those.
    private var degrees: Double {
        let span = high - low
        guard span > 0 else { return 0 }
        let raw = switch high {
        case red: (green - blue) / span
        case green: 2 + (blue - red) / span
        default: 4 + (red - green) / span
        }
        let hue = raw * 60
        return hue < 0 ? hue + 360 : hue
    }

    init(red: Double, green: Double, blue: Double) {
        self.red = red
        self.green = green
        self.blue = blue
    }

    init(_ colour: ArgoColor) {
        self.init(red: colour.red, green: colour.green, blue: colour.blue)
    }
}

extension ArgoPalette.MeasureRoles {
    /// The swatch one band is drawn in, by band rather than by name — what a test needs to go from
    /// the plan's own reading back to the pigment the map was painted with.
    func colour(of band: AtlasBand) -> ArgoColor {
        switch band {
        case .quiet: quiet
        case .middling: middling
        case .hot: hot
        }
    }
}
