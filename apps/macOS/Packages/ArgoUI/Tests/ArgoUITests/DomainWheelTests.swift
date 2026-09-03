import ArgoDesign
@testable import ArgoUI
import Testing

/// The wheel is a RULE rather than a run of colours, because a repository owns how many domains it
/// has. These are the claims that rule keeps at every count a repository can hand it (#1142).
@Suite("Domain wheel — hue carries identity, saturation carries confidence")
struct DomainWheelTests {
    static let palettes = ArgoPalette.all
    /// Every count the wheel is asked to survive. Past about forty the map names every region
    /// anyway, because adjacent hues stop being tellable apart at any saturation.
    static let counts = 2 ... 40

    /// The measured floor the saturation was chosen for: at full confidence no domain, in any
    /// repository from two to forty domains, comes within 0.25 of anything drawn beside it ON THE
    /// MAP. 0.282 is what the worst case really is — asserted rather than described, so a change
    /// to the saturation, the lightness or the turn reds here.
    @Test(arguments: palettes)
    func `at full confidence the worst case over every count clears the map's materials`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        var worst = Double.infinity
        for count in Self.counts {
            for rank in 0 ..< count {
                let hue = palette.atlas.domain.hue(rank)
                for material in palette.atlas.materials.grounds {
                    worst = min(worst, hue.distance(to: material.color))
                }
            }
        }
        #expect(worst > 0.25)
        #expect(abs(worst - 0.282) < 0.001)
    }

    /// The state roles are exempt here, and unlike the measure ramp's exemption this one needs no
    /// argument about what is beside what: a categorical hue carries no good-or-bad reading to
    /// carry over. The number is written down anyway, so the day it moves it moves visibly.
    @Test(arguments: palettes)
    func `the operational states are exempt for the wheel, at a stated number`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        var worst = Double.infinity
        for count in Self.counts {
            for rank in 0 ..< count {
                for status in palette.state.all {
                    worst = min(worst, palette.atlas.domain.hue(rank).distance(to: status.color))
                }
            }
        }
        #expect(abs(worst - 0.151) < 0.001)
    }

    /// What the golden angle is for: two domains that arrive next to each other are never
    /// neighbours on the wheel, at any count. Evenly spacing the hues over the count would do the
    /// opposite — adjacent ranks would be adjacent hues by construction.
    @Test(arguments: palettes)
    func `adjacent ranks are never neighbours in hue`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let domain = appearance.palette.atlas.domain
        for rank in 0 ..< Self.counts.upperBound {
            #expect(domain.hue(rank).distance(to: domain.hue(rank + 1)) > 0.5)
        }
    }

    /// Saturation carries confidence and hue carries identity, so the two are independent: a
    /// domain we are unsure of arrives washed out, and washing it out never moves it on the wheel.
    @Test(arguments: palettes)
    func `confidence drains the saturation and leaves the hue where it was`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let domain = appearance.palette.atlas.domain
        for rank in 0 ..< 12 {
            let spreads = stride(from: 0.0, through: 1.0, by: 0.25).map {
                domain.hue(rank, confidence: $0).chromaticSpread
            }
            #expect(zip(spreads, spreads.dropFirst()).allSatisfy { $1 > $0 })
            // The same channel leads at both ends: the hue did not turn on the way down.
            #expect(loudest(domain.hue(rank, confidence: 0)) == loudest(domain.hue(rank)))
        }
    }

    /// A confidence outside 0…1 is arithmetic that went somewhere; it clamps to an end rather than
    /// drawing a domain louder than the wheel's own ceiling.
    @Test(arguments: palettes)
    func `confidence clamps to the two ends of the saturation range`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let domain = appearance.palette.atlas.domain
        #expect(domain.hue(3, confidence: 2) == domain.hue(3, confidence: 1))
        #expect(domain.hue(3, confidence: -1) == domain.hue(3, confidence: 0))
    }

    /// The run never ends, which is the second thing the turn buys: a rank past any count is a
    /// colour rather than a repeat, and a negative one is a colour too — a rank arriving below
    /// zero is a bug upstream, not a reason for a domain to draw as nothing.
    @Test(arguments: palettes)
    func `the wheel is what the first ranks are, and it never runs out`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let domain = appearance.palette.atlas.domain
        #expect(domain.wheel(count: 4) == (0 ..< 4).map { domain.hue($0) })
        #expect(domain.wheel(count: 0).isEmpty)
        #expect(domain.hue(41) != domain.hue(0))
        #expect(domain.hue(-1) != domain.hue(0))
    }

    /// Which channel is loudest — the crude stand-in for "the hue did not turn", and enough for
    /// the one claim that needs it.
    private func loudest(_ color: ArgoColor) -> Int {
        let channels = [color.red, color.green, color.blue]
        return channels.firstIndex(of: channels.max() ?? 0) ?? 0
    }
}
