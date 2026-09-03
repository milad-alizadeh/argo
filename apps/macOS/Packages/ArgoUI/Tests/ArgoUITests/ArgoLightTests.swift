import ArgoDesign
@testable import ArgoUI
import Testing

/// The light model, and the rule attached to it: every lighting term is a scalar multiply on a
/// band's own pigment, never a hue shift and never a wash toward white (#1142).
@Suite("Light model — a scalar multiply on a band's own pigment")
struct ArgoLightTests {
    static let palettes = ArgoPalette.all

    /// A key lamp and a fill lamp light a thing from opposite sides, or the map has one lit face
    /// and two dark ones.
    @Test
    func `the fill lamp opposes the key`() {
        let key = ArgoLight.key.direction
        let fill = ArgoLight.fill.direction
        #expect(key.x * fill.x + key.y * fill.y + key.z * fill.z < 0)
        #expect(key != .zero)
        #expect(fill != .zero)
        // The sky term comes from everywhere, so it is the one lamp with no direction at all.
        #expect(ArgoLight.ambient.direction == .zero)
    }

    /// Warm key, cool fill, cool sky — the one place this contract spends a tint on a LAMP rather
    /// than on the pigment it lands on.
    @Test
    func `the key is warm and the fill and the sky are cool`() {
        #expect(ArgoLight.key.tint.red >= ArgoLight.key.tint.green)
        #expect(ArgoLight.key.tint.green > ArgoLight.key.tint.blue)
        #expect(ArgoLight.fill.tint.blue > ArgoLight.fill.tint.green)
        #expect(ArgoLight.fill.tint.green > ArgoLight.fill.tint.red)
        #expect(ArgoLight.ambient.tint.blue > ArgoLight.ambient.tint.red)
    }

    /// A fill is a fill: it lifts the dark side rather than competing with the key. And both
    /// shades are turned DOWN from lit — the flat view has no faces to tell apart, and the orbit
    /// widget sits beside the map rather than being it.
    @Test
    func `the fill is quieter than the key, and both shades are turned down`() {
        #expect(ArgoLight.fill.intensity < ArgoLight.key.intensity)
        #expect(ArgoLight.planShade > 0)
        #expect(ArgoLight.planShade < 1)
        #expect(ArgoLight.orbDim > 0)
        #expect(ArgoLight.orbDim < ArgoLight.planShade)
    }

    /// The rule, stated as a claim over the pigments it is really spent on: shading a band never
    /// lifts a channel, and never moves the ratios between them — which is what a hue shift and a
    /// wash toward white each look like in numbers.
    @Test(arguments: palettes)
    func `shading a band scales its pigment and turns no channel`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for band in appearance.palette.atlas.measure.all {
            for shade in ArgoLight.shades.map(\.value) {
                let lit = band.color.scaled(by: shade)
                #expect(lit.red <= band.color.red)
                #expect(lit.green <= band.color.green)
                #expect(lit.blue <= band.color.blue)
                #expect(abs(lit.red * band.color.green - lit.green * band.color.red) < 0.0001)
                #expect(abs(lit.green * band.color.blue - lit.blue * band.color.green) < 0.0001)
                #expect(lit.opacity == band.color.opacity)
            }
        }
    }

    /// A scalar multiply cannot take a channel past the top of the range, whatever it is handed —
    /// a key driven above one brightens until a channel runs out rather than wrapping.
    @Test(arguments: palettes)
    func `a scale above one cannot push a channel past white`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let lit = appearance.palette.atlas.measure.hot.scaled(by: 4)
        #expect(lit.red <= 1)
        #expect(lit.green <= 1)
        #expect(lit.blue <= 1)
    }

    /// An `unwired` entry naming no lamp is deleted, not left to excuse a future one — the same
    /// guard `VisualContractCoverageTests` runs over the other derived families.
    @Test
    func `every unwired note names a lamp that exists`() {
        for name in ArgoLight.unwired.keys {
            #expect(ArgoLight.all.map(\.name).contains(name))
        }
    }
}
